import { createSelectionRepository, readRunSettings } from "../consumer-selection/consumer-selection.ts";
import type { ExceptionRepositoryOf } from "../upgrade/version-one-records/exception-records.ts";
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
import { type CheckLocations, checkLocationsFor } from "./check-locations.ts";
import type { CheckArguments } from "../command-line/command-arguments.ts";
import { type CheckRun, checkCommandOutcome } from "../command-line/command-outcome.ts";
import type { LoadFailure } from "../command-line/load-failure.ts";
import { type PackageLink, packageLinkOf, UNLINKED } from "../command-line/package-link.ts";
import { printOutcome } from "../command-line/print-outcome.ts";
import { projectCommandOf, pruneCommandOf } from "../command-line/tool-invocations.ts";
import { runCheck } from "./run-check.ts";
import { shownFailureOf } from "../command-line/shown-path.ts";

export type CommandRequest = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly git: GitPort;
  readonly exceptionRepositoryOf: ExceptionRepositoryOf;
  readonly moduleUrl: string;
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

const unshownCheckRunAt = async (
  request: Omit<CommandRequest, "process"> & {
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

export type CheckRunAt = (
  request: Omit<CommandRequest, "process"> & { readonly locations: CheckLocations },
) => Promise<Result<CheckRun, LoadFailure>>;

export const checkRunAt: CheckRunAt = async (request) => {
  const { path, fileText } = request;
  const { repoRoot, installRoot } = request.locations;
  const run = await unshownCheckRunAt({ ...request, ...request.locations });
  return run.outcome === "failed"
    ? { outcome: "failed", error: shownFailureOf({ failure: run.error, path, repoRoot, link: packageLinkOf({ path, fileText, repoRoot, installRoot }) }) }
    : run;
};

export const checkRunFromCommand = async (request: CommandRequest): Promise<Result<CheckRun, LoadFailure>> => {
  const locations = checkLocationsFor({
    arguments: request.process.arguments,
    path: request.path,
    fileText: request.fileText,
    moduleUrl: request.moduleUrl,
  });
  return locations.outcome === "failed" ? locations : checkRunAt({ ...request, locations: locations.value });
};

export const runCheckCommand = (request: CommandRequest): Promise<void> =>
  checkRunFromCommand(request).then((checked) =>
    printOutcome({ process: request.process, outcome: checkCommandOutcome({ result: checked }) }),
  );
