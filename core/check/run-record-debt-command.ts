import { readSelection, type SelectionReading } from "../consumer-selection/consumer-selection.ts";
import type { ExceptionRepository, PlacedEntry } from "../exception-records/exception-records.ts";
import { type InheritedDebtOutcome, inheritedDebtEntriesOf, inheritedDebtOf } from "../exception-records/inherited-debt.ts";
import type { GitTreePort } from "../platform-ports/git-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Assessment } from "../values/assessment.ts";
import { moduleExtensionOf } from "../values/install-layout.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import { parseRecordDebtArguments, type RecordDebtArguments } from "./command-arguments.ts";
import { recordDebtCommandOutcome } from "./command-outcome.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "./load-failure.ts";
import { type CommandRequest, printOutcome, repoRootOf, withShownPaths } from "./run-check-command.ts";
import { runCheck } from "./run-check.ts";

type AdoptionRequest = CommandRequest & {
  readonly gitTree: GitTreePort;
  readonly arguments: RecordDebtArguments;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly exceptionRepository: ExceptionRepository;
};

type DebtResult = Result<readonly InheritedDebtOutcome[], LoadFailure>;

const SELECTION_FILE_NAME = "disciplines.json";

const ASSESSED_IN_THIS_RUN: Assessment = { forfeiture: "this-run" };

const reasonOnlySelection = (request: AdoptionRequest): Result<SelectionReading, LoadFailure> => {
  const reading = readSelection({ ...request, moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }) });
  if (reading.outcome === "failed" || reading.value.fileExceptionWhyChains === "optional") {
    return reading;
  }
  return {
    outcome: "failed",
    error: { kind: "why-chains-required", path: request.path.join({ segments: [request.repoRoot, SELECTION_FILE_NAME] }) },
  };
};

const pathsInBase = (request: AdoptionRequest): Result<ReadonlySet<RepoPath>, LoadFailure> => {
  const listed = request.gitTree.pathsAt({ repoRoot: request.repoRoot, revision: request.arguments.baseRevision });
  return listed.outcome === "failed"
    ? { outcome: "failed", error: { kind: "git-failed", detail: `${listed.error.command}: ${listed.error.detail}` } }
    : { outcome: "ok", value: new Set(listed.value) };
};

const debtOutcomesOf = async (
  request: AdoptionRequest & {
    readonly selection: SelectionReading;
    readonly existing: readonly PlacedEntry[];
    readonly inBase: ReadonlySet<RepoPath>;
  },
): Promise<DebtResult> => {
  const report = await runCheck({
    ...request,
    moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }),
    baseRevision: request.arguments.baseRevision,
    assessment: ASSESSED_IN_THIS_RUN,
  });
  if (report.outcome === "failed") {
    return report;
  }
  const outcomes = inheritedDebtOf({
    findings: report.value.findings,
    unrecorded: report.value.unrecorded,
    existing: request.existing,
    leave: request.arguments.leave,
    inBase: request.inBase,
    refusing: request.selection.selection.selected.flatMap((clause) => (clause.exceptions === "refused" ? [clause.address] : [])),
  });
  const written = request.exceptionRepository.add({ entries: inheritedDebtEntriesOf({ outcomes }) });
  return written.outcome === "failed" ? written : { outcome: "ok", value: outcomes };
};

const adoptionDebt = (request: AdoptionRequest): Promise<DebtResult> => {
  const selection = reasonOnlySelection(request);
  if (selection.outcome === "failed") {
    return Promise.resolve(selection);
  }
  const existing = request.exceptionRepository.entries();
  if (existing.outcome === "failed") {
    return Promise.resolve(existing);
  }
  const inBase = pathsInBase(request);
  if (inBase.outcome === "failed") {
    return Promise.resolve(inBase);
  }
  return debtOutcomesOf({ ...request, selection: selection.value, existing: existing.value, inBase: inBase.value });
};

const recordDebtResult = async (request: CommandRequest & { readonly gitTree: GitTreePort }): Promise<DebtResult> => {
  const parsed = parseRecordDebtArguments({ arguments: request.process.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const repoRoot = repoRootOf({ path: request.path, fileText: request.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  const run: DebtResult =
    installRoot.outcome === "failed"
      ? installRoot
      : await adoptionDebt({
          ...request,
          arguments: parsed.value,
          repoRoot: repoRoot.value,
          installRoot: installRoot.value,
          exceptionRepository: request.exceptionRepositoryOf({ repoRoot: repoRoot.value }),
        });
  return withShownPaths({ path: request.path, fileText: request.fileText, repoRoot: repoRoot.value, installRoot, run });
};

export const recordDebtCommandOf =
  (ports: { readonly gitTree: GitTreePort }): ((request: CommandRequest) => Promise<void>) =>
  (request) =>
    recordDebtResult({ ...request, gitTree: ports.gitTree }).then((debt) =>
      printOutcome({ process: request.process, outcome: recordDebtCommandOutcome({ result: debt }) }),
    );
