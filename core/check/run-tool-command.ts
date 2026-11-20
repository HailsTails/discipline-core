import { createDefaultDirectoryPort } from "../platform-ports/file-system-port.ts";
import { createDefaultGitTreePort } from "../platform-ports/git-port.ts";
import { notReadyCommandOf, versionChosenCommandOf } from "../run/version-chosen-command.ts";
import { installedStagesOver, versionTwoCheckCommandOf } from "../run/version-two-check-command.ts";
import { parseInvocation } from "../command-line/command-arguments.ts";
import { helpText } from "./command-help.ts";
import type { Subcommand } from "../command-line/command-line.ts";
import { loadFailureOutcome, versionCommandOutcome } from "../command-line/command-outcome.ts";
import { installedVersionOf } from "./installed-version.ts";
import { type CommandRequest, printOutcome } from "./run-check-command.ts";
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

const versionTwoCheck = versionTwoCheckCommandOf({ gitTree, directory: createDefaultDirectoryPort({}), stagesOver: installedStagesOver });

export const TOOL_SUBCOMMANDS: Subcommands = {
  check: versionChosenCommandOf({ versionOne: runGuidedCheckCommand, versionTwo: versionTwoCheck }),
  project: versionChosenCommandOf({ versionOne: runProjectCommand, versionTwo: notReadyCommandOf({ command: "project" }) }),
  "record-debt": versionChosenCommandOf({ versionOne: recordDebtCommandOf({ gitTree }), versionTwo: notReadyCommandOf({ command: "record-debt" }) }),
  "prune-debt": versionChosenCommandOf({ versionOne: runPruneDebtCommand, versionTwo: notReadyCommandOf({ command: "prune-debt" }) }),
  "split-records": versionChosenCommandOf({ versionOne: runSplitRecordsCommand, versionTwo: notReadyCommandOf({ command: "split-records" }) }),
};

export const runToolCommand: CommandHandler = toolCommandOf({ subcommands: TOOL_SUBCOMMANDS });
