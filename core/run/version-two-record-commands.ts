import { argumentsInvalid } from "../check/argument-problem.ts";
import {
  type AuthoriseArguments,
  parseAuthoriseArguments,
  parsePruneDebtArguments,
  parseRecordDebtArguments,
} from "../check/command-arguments.ts";
import { type CommandOutcome, loadFailureOutcome } from "../check/command-outcome.ts";
import { installRootOf } from "../check/install-root.ts";
import type { LoadFailure } from "../check/load-failure.ts";
import type { CommandRequest } from "../check/run-check-command.ts";
import { printOutcome } from "../check/run-check-command.ts";
import type { FileRemovalPort } from "../platform-ports/file-system-port.ts";
import { authoriseRequestOf } from "../records/authorise-options.ts";
import type { AuthoriseRequest } from "../records/authorising.ts";
import { authoriseOf, pruneDebtOf, type RecordCommandFailure, recordDebtOf } from "../records/record-commands.ts";
import { createRecordsFolder } from "../records/records-folder.ts";
import { createRecordsStore } from "../records/records-store.ts";
import type { RecordsSource } from "../records/records-source.ts";
import type { RecordsStore } from "../records/records-store.ts";
import { authorisingLines, debtOutcomeLine, prunedDebtLine } from "../report/record-command-lines.ts";
import { runLoadFailureLine } from "../report/load-failure-lines.ts";
import { type RunLoadFailure, runLoadFailureOf } from "../report/run-load-failure.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { ForfeitureAssessment } from "../values/assessment.ts";
import { moduleExtensionOf } from "../values/install-layout.ts";
import type { Result } from "../values/result.ts";
import type { VersionTwoCheckRequest } from "./version-two-check-command.ts";
import type { VersionTwoStages } from "./version-two-run.ts";
import { versionTwoRunOver } from "./version-two-run.ts";

const LOAD_FAILURE_CODE = 2;

const THIS_RUN: ForfeitureAssessment = "this-run";

export type VersionTwoRecordRequest = VersionTwoCheckRequest & { readonly removal: FileRemovalPort };

type Located = { readonly repoRoot: AbsolutePath; readonly installRoot: AbsolutePath };

type Context = {
  readonly request: VersionTwoRecordRequest;
  readonly command: CommandRequest;
  readonly located: Located;
};

const lineOfFailure = (request: { readonly failure: RunLoadFailure }): CommandOutcome => ({
  code: LOAD_FAILURE_CODE,
  text: `${runLoadFailureLine({ failure: request.failure, upgradeCommand: undefined })}\n`,
});

const recordFailureOutcome = (request: { readonly failure: RecordCommandFailure }): CommandOutcome =>
  lineOfFailure({ failure: runLoadFailureOf({ engines: [], source: request.failure }) });

const linesOutcome = (request: { readonly lines: readonly string[] }): CommandOutcome => ({
  code: 0,
  text: request.lines.map((line) => `${line}\n`).join(""),
});

const locatedOf = (request: { readonly command: CommandRequest; readonly repo: string }): Result<Located, LoadFailure> => {
  const { command } = request;
  const resolved = command.path.resolve({ path: request.repo });
  if (resolved.outcome === "failed") {
    return argumentsInvalid({ problem: { kind: "repo-unresolvable", given: request.repo } });
  }
  const installRoot = installRootOf({ path: command.path, moduleUrl: command.moduleUrl });
  return installRoot.outcome === "failed" ? installRoot : { outcome: "ok", value: { repoRoot: resolved.value, installRoot: installRoot.value } };
};

const stagesOf = (request: Context & { readonly baseRevision: string | undefined }): VersionTwoStages => {
  const { fileText, path, modules, git } = request.command;
  return request.request.stagesOver({
    ports: { fileText, path, modules, git, gitTree: request.request.gitTree, directory: request.request.directory },
    locations: {
      repoRoot: request.located.repoRoot,
      installRoot: request.located.installRoot,
      moduleExtension: moduleExtensionOf({ moduleUrl: request.command.moduleUrl }),
      baseRevision: request.baseRevision,
    },
  });
};

const sourceOf = (request: Context): RecordsSource => {
  const { fileText, path, git } = request.command;
  return createRecordsFolder({ fileText, path, git, gitTree: request.request.gitTree, directory: request.request.directory, repoRoot: request.located.repoRoot });
};

const storeOf = (request: Context): RecordsStore => {
  const { fileText, path } = request.command;
  return createRecordsStore({ fileText, path, removal: request.request.removal, directory: request.request.directory, repoRoot: request.located.repoRoot });
};

const recordDebtOutcome = async (request: { readonly request: VersionTwoRecordRequest; readonly command: CommandRequest }): Promise<CommandOutcome> => {
  const parsed = parseRecordDebtArguments({ arguments: request.command.process.arguments });
  if (parsed.outcome === "failed") {
    return loadFailureOutcome({ failure: parsed.error });
  }
  const located = locatedOf({ command: request.command, repo: parsed.value.repo });
  if (located.outcome === "failed") {
    return loadFailureOutcome({ failure: located.error });
  }
  const context: Context = { ...request, located: located.value };
  const run = await versionTwoRunOver({
    stages: stagesOf({ ...context, baseRevision: parsed.value.baseRevision }),
    arguments: { forfeiture: THIS_RUN, reportOutput: undefined },
  });
  if (run.outcome === "failed") {
    return lineOfFailure({ failure: run.error });
  }
  const recorded = recordDebtOf({
    catalogue: run.value.catalogue,
    repoRoot: located.value.repoRoot,
    source: sourceOf(context),
    store: storeOf(context),
    git: request.command.git,
  })({ findings: run.value.report.findings, baseRevision: parsed.value.baseRevision, leave: parsed.value.leave, forfeiture: THIS_RUN });
  return recorded.outcome === "failed" ? recordFailureOutcome({ failure: recorded.error }) : linesOutcome({ lines: recorded.value.map((outcome) => debtOutcomeLine({ outcome })) });
};

const pruneDebtOutcome = async (request: { readonly request: VersionTwoRecordRequest; readonly command: CommandRequest }): Promise<CommandOutcome> => {
  const parsed = parsePruneDebtArguments({ arguments: request.command.process.arguments });
  if (parsed.outcome === "failed") {
    return loadFailureOutcome({ failure: parsed.error });
  }
  const located = locatedOf({ command: request.command, repo: parsed.value.repo });
  if (located.outcome === "failed") {
    return loadFailureOutcome({ failure: located.error });
  }
  const context: Context = { ...request, located: located.value };
  const run = await versionTwoRunOver({
    stages: stagesOf({ ...context, baseRevision: parsed.value.baseRevision }),
    arguments: { forfeiture: parsed.value.forfeiture, reportOutput: undefined },
  });
  if (run.outcome === "failed") {
    return lineOfFailure({ failure: run.error });
  }
  const pruned = pruneDebtOf({ source: sourceOf(context), store: storeOf(context) })({ report: run.value.report });
  return pruned.outcome === "failed" ? recordFailureOutcome({ failure: pruned.error }) : linesOutcome({ lines: pruned.value.map((debt) => prunedDebtLine({ pruned: debt })) });
};

const authoriseRequestFrom = (request: { readonly parsed: AuthoriseArguments }): Result<AuthoriseRequest, LoadFailure> =>
  authoriseRequestOf({ values: request.parsed.values });

const authoriseOutcome = async (request: { readonly request: VersionTwoRecordRequest; readonly command: CommandRequest }): Promise<CommandOutcome> => {
  const parsed = parseAuthoriseArguments({ arguments: request.command.process.arguments });
  if (parsed.outcome === "failed") {
    return loadFailureOutcome({ failure: parsed.error });
  }
  const authorising = authoriseRequestFrom({ parsed: parsed.value });
  if (authorising.outcome === "failed") {
    return loadFailureOutcome({ failure: authorising.error });
  }
  const located = locatedOf({ command: request.command, repo: parsed.value.repo });
  if (located.outcome === "failed") {
    return loadFailureOutcome({ failure: located.error });
  }
  const context: Context = { ...request, located: located.value };
  const catalogue = stagesOf({ ...context, baseRevision: undefined }).catalogue();
  if (catalogue.outcome === "failed") {
    return lineOfFailure({ failure: catalogue.error });
  }
  const authorised = authoriseOf({ catalogue: catalogue.value, source: sourceOf(context), store: storeOf(context) })(authorising.value);
  return authorised.outcome === "failed"
    ? recordFailureOutcome({ failure: authorised.error })
    : linesOutcome({ lines: authorisingLines({ address: authorising.value.symptom, file: authorising.value.file, authorising: authorised.value }) });
};

const handlerOf =
  (outcomeOf: (request: { readonly request: VersionTwoRecordRequest; readonly command: CommandRequest }) => Promise<CommandOutcome>) =>
  (request: VersionTwoRecordRequest) =>
  async (command: CommandRequest): Promise<void> => {
    printOutcome({ process: command.process, outcome: await outcomeOf({ request, command }) });
  };

export const versionTwoRecordDebtCommandOf = handlerOf(recordDebtOutcome);

export const versionTwoPruneDebtCommandOf = handlerOf(pruneDebtOutcome);

export const versionTwoAuthoriseCommandOf = handlerOf(authoriseOutcome);
