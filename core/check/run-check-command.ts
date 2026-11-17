import { readRunSettings } from "../consumer-selection/consumer-selection.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { type Assessment, type AssessmentRequest, assessmentInEffect } from "../values/assessment.ts";
import { type ReportOutput, reportOutputInEffect } from "../values/report-output.ts";
import type { Result } from "../values/result.ts";
import type { CheckReport } from "../verdict/check-report.ts";
import { BASE_REVISION_OPTION, FORFEITURE_OPTION, parseCheckArguments } from "./command-arguments-schema.ts";
import { type CheckRun, type CommandOutcome, checkCommandOutcome } from "./command-outcome.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "./load-failure.ts";
import { runCheck } from "./run-check.ts";
import { moduleExtensionOf } from "../values/install-layout.ts";

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
  readonly repo: string;
}): Result<AbsolutePath, LoadFailure> => {
  const resolved = request.path.resolve({ path: request.repo });
  if (resolved.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "arguments-invalid", detail: `--repo ${request.repo} resolves to no absolute path` },
    };
  }
  return resolved;
};

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

const forfeitureSourceOf = (request: { readonly requested: AssessmentRequest }): string =>
  request.requested.forfeiture === undefined ? "assessment.forfeiture in disciplines.json" : FORFEITURE_OPTION;

const assessmentForRun = (request: {
  readonly requested: AssessmentRequest;
  readonly configured: Assessment;
  readonly baseRevision: string | undefined;
}): Result<Assessment, LoadFailure> => {
  const assessment = assessmentInEffect(request);
  if (assessment.forfeiture === "elsewhere" && request.baseRevision !== undefined) {
    return {
      outcome: "failed",
      error: {
        kind: "arguments-invalid",
        detail: `${BASE_REVISION_OPTION} measures carve-out decay, but ${forfeitureSourceOf(request)} is elsewhere; give ${FORFEITURE_OPTION} this-run to assess forfeiture in this run, or leave out ${BASE_REVISION_OPTION}`,
      },
    };
  }
  return { outcome: "ok", value: assessment };
};

export const checkRunFor = async (request: CommandRequest): Promise<Result<CheckRun, LoadFailure>> => {
  const parsed = parseCheckArguments({ arguments: request.process.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const repoRoot = repoRootOf({ path: request.path, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  if (installRoot.outcome === "failed") {
    return installRoot;
  }
  const configured = readRunSettings({ fileText: request.fileText, path: request.path, repoRoot: repoRoot.value });
  if (configured.outcome === "failed") {
    return configured;
  }
  const assessment = assessmentForRun({
    requested: { forfeiture: parsed.value.forfeiture },
    configured: configured.value.assessment,
    baseRevision: parsed.value.baseRevision,
  });
  if (assessment.outcome === "failed") {
    return assessment;
  }
  const report = await runCheck({
    repoRoot: repoRoot.value,
    installRoot: installRoot.value,
    moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }),
    baseRevision: parsed.value.baseRevision,
    forfeiture: assessment.value.forfeiture,
    fileText: request.fileText,
    modules: request.modules,
    path: request.path,
    git: request.git,
  });
  return checkRunOf({
    report,
    output: reportOutputInEffect({ requested: parsed.value.reportOutput, configured: configured.value.reportOutput }),
  });
};

export const runCheckCommand = (request: CommandRequest): Promise<void> =>
  checkRunFor(request).then((checked) =>
    printOutcome({ process: request.process, outcome: checkCommandOutcome({ result: checked }) }),
  );
