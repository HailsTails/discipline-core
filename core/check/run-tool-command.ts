import { createDefaultExceptionRepositoryOf } from "../exception-records/exception-layout.ts";
import { createDefaultDirectoryRemovalPort } from "../platform-ports/directory-removal-port.ts";
import { createDefaultFileCreationPort } from "../platform-ports/file-creation-port.ts";
import { createDefaultDirectoryPort, createDefaultEntryKindPort } from "../platform-ports/file-system-port.ts";
import { alreadyUpgradedCommand, upgradeCommandOf } from "../upgrade/command/run-upgrade-command.ts";
import { unwrittenProjectionSupply } from "../upgrade/command/unwritten-projection-supply.ts";
import { createRecordsFolder } from "../records/records-folder.ts";
import { createDefaultFileRemovalPort } from "../platform-ports/file-removal-port.ts";
import { createDefaultGitTreePort } from "../platform-ports/git-port.ts";
import { notReadyCommandOf, versionChosenCommandOf } from "../run/version-chosen-command.ts";
import { versionTwoCheckCommandOf } from "../run/version-two-check-command.ts";
import { versionTwoNeededCommandOf } from "../run/version-two-needed-command.ts";
import { versionTwoAuthoriseCommandOf, versionTwoPruneDebtCommandOf, versionTwoRecordDebtCommandOf } from "../run/version-two-record-commands.ts";
import { installedStagesOver } from "../run/version-two-repository.ts";
import { versionOneAwareRecordsSourceOf } from "../upgrade/version-one-at-base/base-standing-records-source.ts";
import { parseInvocation } from "../command-line/command-arguments.ts";
import { helpText } from "./command-help.ts";
import type { Subcommand } from "../command-line/command-line.ts";
import { loadFailureOutcome, versionCommandOutcome } from "../command-line/command-outcome.ts";
import { installedVersionOf } from "./installed-version.ts";
import { printOutcome } from "../command-line/print-outcome.ts";
import type { CommandRequest } from "./run-check-command.ts";
import { runGuidedCheckCommand } from "./run-guided-check-command.ts";
import { runProjectCommand } from "./run-project-command.ts";
import { runPruneDebtCommand } from "./run-prune-debt-command.ts";
import { recordDebtCommandOf } from "./run-record-debt-command.ts";
import { runSplitRecordsCommand } from "./run-split-records-command.ts";

export type CommandHandler = (request: CommandRequest) => Promise<void>;

export type Subcommands = Readonly<Record<Subcommand, CommandHandler>>;

const thrownMessage = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

const dispatched = (request: { readonly subcommands: Subcommands; readonly command: CommandRequest }): Promise<void> => {
  const { command } = request;
  const invocation = parseInvocation({ arguments: command.process.arguments });
  if (invocation.outcome === "failed") {
    printOutcome({ process: command.process, outcome: loadFailureOutcome({ failure: invocation.error }) });
    return Promise.resolve();
  }
  switch (invocation.value.kind) {
    case "help":
      printOutcome({ process: command.process, outcome: { code: 0, text: helpText(invocation.value) } });
      return Promise.resolve();
    case "version":
      printOutcome({ process: command.process, outcome: versionCommandOutcome({ result: installedVersionOf(command) }) });
      return Promise.resolve();
    case "run":
      return request.subcommands[invocation.value.subcommand]({
        ...command,
        process: { ...command.process, arguments: invocation.value.arguments },
      });
  }
};

export const toolCommandOf =
  (request: { readonly subcommands: Subcommands }): CommandHandler =>
  (command) =>
    Promise.resolve()
      .then(() => dispatched({ subcommands: request.subcommands, command }))
      .catch((thrown: unknown) => {
        printOutcome({
          process: command.process,
          outcome: loadFailureOutcome({ failure: { kind: "unexpected-error", detail: thrownMessage({ thrown }) } }),
        });
      });

const gitTree = createDefaultGitTreePort({});

const versionTwoPorts = {
  gitTree,
  directory: createDefaultDirectoryPort({}),
  stagesOver: installedStagesOver,
  recordsSourceOf: versionOneAwareRecordsSourceOf({
    recordsSourceOf: createRecordsFolder,
    exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  }),
};

const versionTwoCheck = versionTwoCheckCommandOf(versionTwoPorts);

const versionTwoRecordPorts = { ...versionTwoPorts, removal: createDefaultFileRemovalPort({}) };

const upgradePorts = {
  ...versionTwoPorts,
  fileCreation: createDefaultFileCreationPort({}),
  fileRemoval: createDefaultFileRemovalPort({}),
  directoryRemoval: createDefaultDirectoryRemovalPort({}),
  entryKind: createDefaultEntryKindPort({}),
  projection: unwrittenProjectionSupply,
};

export const TOOL_SUBCOMMANDS: Subcommands = {
  check: versionChosenCommandOf({ versionOne: runGuidedCheckCommand, versionTwo: versionTwoCheck }),
  project: versionChosenCommandOf({ versionOne: runProjectCommand, versionTwo: notReadyCommandOf({ command: "project" }) }),
  "record-debt": versionChosenCommandOf({ versionOne: recordDebtCommandOf({ gitTree }), versionTwo: versionTwoRecordDebtCommandOf(versionTwoRecordPorts) }),
  "prune-debt": versionChosenCommandOf({ versionOne: runPruneDebtCommand, versionTwo: versionTwoPruneDebtCommandOf(versionTwoRecordPorts) }),
  authorise: versionChosenCommandOf({ versionOne: versionTwoNeededCommandOf, versionTwo: versionTwoAuthoriseCommandOf(versionTwoRecordPorts) }),
  "split-records": versionChosenCommandOf({ versionOne: runSplitRecordsCommand, versionTwo: notReadyCommandOf({ command: "split-records" }) }),
  upgrade: versionChosenCommandOf({ versionOne: upgradeCommandOf(upgradePorts), versionTwo: alreadyUpgradedCommand }),
};

export const runToolCommand: CommandHandler = toolCommandOf({ subcommands: TOOL_SUBCOMMANDS });
