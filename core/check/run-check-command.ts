import { createSelectionRepository, readRunSettings } from "../consumer-selection/consumer-selection.ts";
import type { ExceptionRepositoryOf } from "../exception-records/exception-records.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { assessmentInEffect } from "../values/assessment.ts";
import { moduleExtensionOf } from "../values/install-layout.ts";
import { type ReportOutput, reportOutputInEffect } from "../values/report-output.ts";
import type { Result } from "../values/result.ts";
import type { CheckReport } from "../verdict/check-report.ts";
import { argumentsInvalid } from "./argument-problem.ts";
import { type CheckArguments, parseCheckArguments } from "./command-arguments.ts";
import { type CheckRun, type CommandOutcome, checkCommandOutcome } from "./command-outcome.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "./load-failure.ts";
import { type PackageLink, packageLinkOf, UNLINKED } from "./package-link.ts";
import { projectCommandOf, pruneCommandOf } from "./tool-invocations.ts";
import { runCheck } from "./run-check.ts";
import { shownFailureOf } from "./shown-path.ts";

const SELECTION_FILE_NAME = "disciplines.json";

export type CommandRequest = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly git: GitPort;
  readonly exceptionRepositoryOf: ExceptionRepositoryOf;
  readonly moduleUrl: string;
};

export const repoRootOf = (request: {
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly repo: string;
}): Result<AbsolutePath, LoadFailure> => {
  const resolved = request.path.resolve({ path: request.repo });
  if (resolved.outcome === "failed") {
    return argumentsInvalid({ problem: { kind: "repo-unresolvable", given: request.repo } });
  }
  const selection = request.path.join({ segments: [resolved.value, SELECTION_FILE_NAME] });
  return request.fileText.exists({ path: selection }) === "absent"
    ? { outcome: "failed", error: { kind: "selection-absent", repo: request.repo } }
    : resolved;
};

type ShownPathsRequest = {
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: Result<AbsolutePath, LoadFailure>;
};

const installLinkOf = (request: ShownPathsRequest): PackageLink =>
  request.installRoot.outcome === "failed" ? UNLINKED : packageLinkOf({ ...request, installRoot: request.installRoot.value });

export const withShownPaths = <Value>(
  request: ShownPathsRequest & { readonly run: Result<Value, LoadFailure> },
): Result<Value, LoadFailure> =>
  request.run.outcome === "failed"
    ? {
        outcome: "failed",
        error: shownFailureOf({ failure: request.run.error, path: request.path, repoRoot: request.repoRoot, link: installLinkOf(request) }),
      }
    : request.run;

export const printOutcome = (request: {
  readonly process: ProcessPort;
  readonly outcome: CommandOutcome;
}): void => {
  request.process.writeOut({ text: request.outcome.text });
  request.process.exitWith({ code: request.outcome.code });
};

const checkRunOf = (request: {
  readonly report: Result<CheckReport, LoadFailure>;
  readonly output: ReportOutput;
  readonly projectCommand: string;
  readonly pruneCommand: string;
}): Result<CheckRun, LoadFailure> =>
  request.report.outcome === "failed"
    ? request.report
    : {
        outcome: "ok",
        value: { report: request.report.value, output: request.output, projectCommand: request.projectCommand, pruneCommand: request.pruneCommand },
      };

const checkRunIn = async (
  request: CommandRequest & {
    readonly arguments: CheckArguments;
    readonly repoRoot: AbsolutePath;
    readonly installRoot: AbsolutePath;
  },
): Promise<Result<CheckRun, LoadFailure>> => {
  const projectCommand = projectCommandOf({ path: request.path, moduleUrl: request.moduleUrl, repoRoot: request.repoRoot });
  if (projectCommand.outcome === "failed") {
    return projectCommand;
  }
  const pruneCommand = pruneCommandOf({
    path: request.path,
    moduleUrl: request.moduleUrl,
    repoRoot: request.repoRoot,
    baseRevision: request.arguments.baseRevision,
    forfeiture: request.arguments.forfeiture,
  });
  if (pruneCommand.outcome === "failed") {
    return pruneCommand;
  }
  const configured = readRunSettings({ fileText: request.fileText, path: request.path, repoRoot: request.repoRoot });
  if (configured.outcome === "failed") {
    return configured;
  }
  const assessment = assessmentInEffect({
    requested: { forfeiture: request.arguments.forfeiture },
    configured: configured.value.assessment,
  });
  const moduleExtension = moduleExtensionOf({ moduleUrl: request.moduleUrl });
  const report = await runCheck({
    repoRoot: request.repoRoot,
    installRoot: request.installRoot,
    moduleExtension,
    baseRevision: request.arguments.baseRevision,
    assessment,
    fileText: request.fileText,
    modules: request.modules,
    path: request.path,
    git: request.git,
    selectionRepository: createSelectionRepository({ ...request, moduleExtension }),
    exceptionRepository: request.exceptionRepositoryOf({ repoRoot: request.repoRoot }),
  });
  return checkRunOf({
    report,
    output: reportOutputInEffect({ requested: request.arguments.reportOutput, configured: configured.value.reportOutput }),
    projectCommand: projectCommand.value,
    pruneCommand: pruneCommand.value,
  });
};

export const checkRunFor = async (request: CommandRequest): Promise<Result<CheckRun, LoadFailure>> => {
  const parsed = parseCheckArguments({ arguments: request.process.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const repoRoot = repoRootOf({ path: request.path, fileText: request.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  return withShownPaths({
    path: request.path,
    fileText: request.fileText,
    repoRoot: repoRoot.value,
    installRoot,
    run:
      installRoot.outcome === "failed"
        ? installRoot
        : await checkRunIn({ ...request, arguments: parsed.value, repoRoot: repoRoot.value, installRoot: installRoot.value }),
  });
};

export const runCheckCommand = (request: CommandRequest): Promise<void> =>
  checkRunFor(request).then((checked) =>
    printOutcome({ process: request.process, outcome: checkCommandOutcome({ result: checked }) }),
  );
