import { parseAuthoriseArguments, parsePruneDebtArguments, parseRecordDebtArguments } from "../command-line/command-arguments.ts";
import { type CommandOutcome, loadFailureOutcome } from "../command-line/command-outcome.ts";
import type { LoadFailure } from "../command-line/load-failure.ts";
import type { CommandRequest } from "../check/run-check-command.ts";
import { printOutcome } from "../command-line/print-outcome.ts";
import type { FileRemovalPort } from "../platform-ports/file-system-port.ts";
import { authoriseRequestOf } from "../records/authorise-options.ts";
import type { AuthoriseRequest } from "../records/authorising.ts";
import { authoriseOf, pruneDebtOf, type RecordCommandFailure, recordDebtOf } from "../records/record-commands.ts";
import type { RecordsSource } from "../records/records-source.ts";
import type { RecordsStore } from "../records/records-store.ts";
import { createRecordsStore } from "../records/records-store.ts";
import { authorisingLines, debtOutcomeLine, prunedDebtLine } from "../report/record-command-lines.ts";
import { runLoadFailureOf } from "../report/run-load-failure.ts";
import type { SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { Result } from "../values/result.ts";
import { runLoadFailureOutcomeOf } from "./run-load-failure-outcome.ts";
import { type RepositoryLocated, repositoryLocatedOf, stagesOverRepository, type VersionTwoRepositoryPorts } from "./version-two-repository.ts";
import { versionTwoRunOver } from "./version-two-run.ts";

export type VersionTwoRecordPorts = VersionTwoRepositoryPorts & { readonly removal: FileRemovalPort };

type Context = {
  readonly ports: VersionTwoRecordPorts;
  readonly command: CommandRequest;
  readonly located: RepositoryLocated;
};

type OutcomeOf = (request: { readonly ports: VersionTwoRecordPorts; readonly command: CommandRequest }) => Promise<CommandOutcome>;

const recordFailureOutcome = (request: { readonly failure: RecordCommandFailure }): CommandOutcome =>
  runLoadFailureOutcomeOf({ failure: runLoadFailureOf({ engines: [], source: request.failure }) });

const linesOutcome = (request: { readonly lines: readonly string[] }): CommandOutcome => ({
  code: 0,
  text: request.lines.map((line) => `${line}\n`).join(""),
});

const sourceOf = (request: Context & { readonly catalogue: SymptomCatalogue }): RecordsSource => {
  const { fileText, path, git } = request.command;
  return request.ports.recordsSourceOf({
    fileText,
    path,
    git,
    gitTree: request.ports.gitTree,
    directory: request.ports.directory,
    repoRoot: request.located.repoRoot,
    catalogue: request.catalogue,
  });
};

const storeOf = (request: Context): RecordsStore => {
  const { fileText, path } = request.command;
  return createRecordsStore({ fileText, path, removal: request.ports.removal, directory: request.ports.directory, repoRoot: request.located.repoRoot });
};

const contextOf = (request: { readonly ports: VersionTwoRecordPorts; readonly command: CommandRequest; readonly repo: string }): Result<Context, LoadFailure> => {
  const located = repositoryLocatedOf(request);
  return located.outcome === "failed" ? located : { outcome: "ok", value: { ports: request.ports, command: request.command, located: located.value } };
};

const recordDebtOutcome: OutcomeOf = async (request) => {
  const parsed = parseRecordDebtArguments({ arguments: request.command.process.arguments });
  if (parsed.outcome === "failed") {
    return loadFailureOutcome({ failure: parsed.error });
  }
  const context = contextOf({ ...request, repo: parsed.value.repo });
  if (context.outcome === "failed") {
    return loadFailureOutcome({ failure: context.error });
  }
  const stages = stagesOverRepository({ ...context.value, baseRevision: parsed.value.baseRevision });
  const run = await versionTwoRunOver({ stages, arguments: { forfeiture: undefined, reportOutput: undefined, measuring: "always" } });
  if (run.outcome === "failed") {
    return runLoadFailureOutcomeOf({ failure: run.error });
  }
  const recorded = recordDebtOf({ catalogue: run.value.catalogue, source: sourceOf({ ...context.value, catalogue: run.value.catalogue }), store: storeOf(context.value) })({
    findings: run.value.report.findings,
    touched: run.value.touched,
    leave: parsed.value.leave,
  });
  return recorded.outcome === "failed" ? recordFailureOutcome({ failure: recorded.error }) : linesOutcome({ lines: recorded.value.map((outcome) => debtOutcomeLine({ outcome })) });
};

const pruneDebtOutcome: OutcomeOf = async (request) => {
  const parsed = parsePruneDebtArguments({ arguments: request.command.process.arguments });
  if (parsed.outcome === "failed") {
    return loadFailureOutcome({ failure: parsed.error });
  }
  const context = contextOf({ ...request, repo: parsed.value.repo });
  if (context.outcome === "failed") {
    return loadFailureOutcome({ failure: context.error });
  }
  const run = await versionTwoRunOver({
    stages: stagesOverRepository({ ...context.value, baseRevision: parsed.value.baseRevision }),
    arguments: { forfeiture: parsed.value.forfeiture, reportOutput: undefined, measuring: "when-debt-held" },
  });
  if (run.outcome === "failed") {
    return runLoadFailureOutcomeOf({ failure: run.error });
  }
  const pruned = pruneDebtOf({ source: sourceOf({ ...context.value, catalogue: run.value.catalogue }), store: storeOf(context.value) })({ report: run.value.report });
  return pruned.outcome === "failed" ? recordFailureOutcome({ failure: pruned.error }) : linesOutcome({ lines: pruned.value.map((debt) => prunedDebtLine({ pruned: debt })) });
};

const authorisedOutcome = (request: { readonly context: Context; readonly authorising: AuthoriseRequest }): CommandOutcome => {
  const { context, authorising } = request;
  const catalogue = stagesOverRepository({ ...context, baseRevision: undefined }).catalogue();
  if (catalogue.outcome === "failed") {
    return runLoadFailureOutcomeOf({ failure: catalogue.error });
  }
  const authorised = authoriseOf({ catalogue: catalogue.value, source: sourceOf({ ...context, catalogue: catalogue.value }), store: storeOf(context) })(authorising);
  return authorised.outcome === "failed"
    ? recordFailureOutcome({ failure: authorised.error })
    : linesOutcome({ lines: authorisingLines({ address: authorising.symptom, file: authorising.file, authorising: authorised.value }) });
};

const authoriseOutcome: OutcomeOf = (request) => {
  const parsed = parseAuthoriseArguments({ arguments: request.command.process.arguments });
  if (parsed.outcome === "failed") {
    return Promise.resolve(loadFailureOutcome({ failure: parsed.error }));
  }
  const authorising = authoriseRequestOf({ values: parsed.value.values });
  if (authorising.outcome === "failed") {
    return Promise.resolve(loadFailureOutcome({ failure: authorising.error }));
  }
  const context = contextOf({ ...request, repo: parsed.value.repo });
  return Promise.resolve(
    context.outcome === "failed"
      ? loadFailureOutcome({ failure: context.error })
      : authorisedOutcome({ context: context.value, authorising: authorising.value }),
  );
};

const handlerOf =
  (outcomeOf: OutcomeOf) =>
  (ports: VersionTwoRecordPorts) =>
  async (command: CommandRequest): Promise<void> => {
    printOutcome({ process: command.process, outcome: await outcomeOf({ ports, command }) });
  };

export const versionTwoRecordDebtCommandOf = handlerOf(recordDebtOutcome);

export const versionTwoPruneDebtCommandOf = handlerOf(pruneDebtOutcome);

export const versionTwoAuthoriseCommandOf = handlerOf(authoriseOutcome);
