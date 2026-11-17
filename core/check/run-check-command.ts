import { readRunSettings } from "../consumer-selection/consumer-selection.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { assessmentInEffect } from "../values/assessment.ts";
import { type ReportOutput, reportOutputInEffect } from "../values/report-output.ts";
import type { Result } from "../values/result.ts";
import type { CheckReport } from "../verdict/check-report.ts";
import { argumentsInvalid } from "./argument-problem.ts";
import { type CheckArguments, parseCheckArguments } from "./command-arguments.ts";
import { type CheckRun, type CommandOutcome, checkCommandOutcome } from "./command-outcome.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "./load-failure.ts";
import { runCheck } from "./run-check.ts";
import { shownFailureOf } from "./shown-path.ts";
import { moduleExtensionOf } from "../values/install-layout.ts";

const SELECTION_FILE_NAME = "disciplines.json";

export type CommandRequest = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly git: GitPort;
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

export const withShownPaths = <Value>(request: {
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly run: Result<Value, LoadFailure>;
}): Result<Value, LoadFailure> =>
  request.run.outcome === "failed"
    ? { outcome: "failed", error: shownFailureOf({ failure: request.run.error, path: request.path, repoRoot: request.repoRoot }) }
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
}): Result<CheckRun, LoadFailure> =>
  request.report.outcome === "failed"
    ? request.report
    : { outcome: "ok", value: { report: request.report.value, output: request.output } };

const checkRunIn = async (
  request: CommandRequest & { readonly arguments: CheckArguments; readonly repoRoot: AbsolutePath },
): Promise<Result<CheckRun, LoadFailure>> => {
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  if (installRoot.outcome === "failed") {
    return installRoot;
  }
  const configured = readRunSettings({ fileText: request.fileText, path: request.path, repoRoot: request.repoRoot });
  if (configured.outcome === "failed") {
    return configured;
  }
  const assessment = assessmentInEffect({
    requested: { forfeiture: request.arguments.forfeiture },
    configured: configured.value.assessment,
  });
  const report = await runCheck({
    repoRoot: request.repoRoot,
    installRoot: installRoot.value,
    moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }),
    baseRevision: request.arguments.baseRevision,
    assessment,
    fileText: request.fileText,
    modules: request.modules,
    path: request.path,
    git: request.git,
  });
  return checkRunOf({
    report,
    output: reportOutputInEffect({ requested: request.arguments.reportOutput, configured: configured.value.reportOutput }),
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
  return withShownPaths({
    path: request.path,
    repoRoot: repoRoot.value,
    run: await checkRunIn({ ...request, arguments: parsed.value, repoRoot: repoRoot.value }),
  });
};

export const runCheckCommand = (request: CommandRequest): Promise<void> =>
  checkRunFor(request).then((checked) =>
    printOutcome({ process: request.process, outcome: checkCommandOutcome({ result: checked }) }),
  );
