import { argumentsInvalid } from "../command-line/argument-problem.ts";
import { type CheckArguments, parseCheckArguments } from "../command-line/command-arguments.ts";
import { type CommandOutcome, loadFailureOutcome } from "../command-line/command-outcome.ts";
import { installRootOf } from "../command-line/install-root.ts";
import type { LoadFailure } from "../command-line/load-failure.ts";
import { packageLinkOf } from "../command-line/package-link.ts";
import type { CommandRequest } from "../check/run-check-command.ts";
import { printOutcome } from "../command-line/print-outcome.ts";
import { shownPathOf } from "../command-line/shown-path.ts";
import { projectCommandOf, pruneCommandOf } from "../command-line/tool-invocations.ts";
import { runLoadFailureLine } from "../report/load-failure-lines.ts";
import type { RunLoadFailure } from "../report/run-load-failure.ts";
import { renderRunReportText } from "../report/run-report-text.ts";
import { runVerdictOf } from "../report/report-sections.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { moduleExtensionOf } from "../values/install-layout.ts";
import type { Result } from "../values/result.ts";
import { type VersionTwoLocations, type VersionTwoPorts, versionTwoStagesOver } from "./version-two-stages.ts";
import { type VersionTwoRun, type VersionTwoStages, versionTwoRunOver } from "./version-two-run.ts";

const SYMPTOM_PAGE_SEGMENTS: readonly string[] = ["rules", "typescript", "symptoms.md"];

const LOAD_FAILURE_CODE = 2;

export type StagesOver = (request: { readonly ports: VersionTwoPorts; readonly locations: VersionTwoLocations }) => VersionTwoStages;

export type VersionTwoCheckRequest = {
  readonly gitTree: VersionTwoPorts["gitTree"];
  readonly directory: VersionTwoPorts["directory"];
  readonly stagesOver: StagesOver;
};

export const installedStagesOver: StagesOver = versionTwoStagesOver;

type Commands = { readonly project: string; readonly prune: string };

type Located = {
  readonly arguments: CheckArguments;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly commands: Commands;
};

const commandsOf = (request: { readonly command: CommandRequest; readonly arguments: CheckArguments; readonly repoRoot: AbsolutePath }): Result<Commands, LoadFailure> => {
  const { path, moduleUrl } = request.command;
  const invocation = { path, moduleUrl, repoRoot: request.repoRoot };
  const project = projectCommandOf(invocation);
  if (project.outcome === "failed") {
    return project;
  }
  const prune = pruneCommandOf({ ...invocation, baseRevision: request.arguments.baseRevision, forfeiture: request.arguments.forfeiture });
  return prune.outcome === "failed" ? prune : { outcome: "ok", value: { project: project.value, prune: prune.value } };
};

const locatedOf = (request: { readonly command: CommandRequest }): Result<Located, LoadFailure> => {
  const { command } = request;
  const parsed = parseCheckArguments({ arguments: command.process.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const resolved = command.path.resolve({ path: parsed.value.repo });
  if (resolved.outcome === "failed") {
    return argumentsInvalid({ problem: { kind: "repo-unresolvable", given: parsed.value.repo } });
  }
  const installRoot = installRootOf({ path: command.path, moduleUrl: command.moduleUrl });
  if (installRoot.outcome === "failed") {
    return installRoot;
  }
  const commands = commandsOf({ command, arguments: parsed.value, repoRoot: resolved.value });
  return commands.outcome === "failed"
    ? commands
    : { outcome: "ok", value: { arguments: parsed.value, repoRoot: resolved.value, installRoot: installRoot.value, commands: commands.value } };
};

const symptomPageOf = (request: { readonly command: CommandRequest; readonly located: Located }): string => {
  const { path, fileText } = request.command;
  const { repoRoot, installRoot } = request.located;
  return shownPathOf({
    path,
    repoRoot,
    link: packageLinkOf({ path, fileText, repoRoot, installRoot }),
    target: path.join({ segments: [installRoot, ...SYMPTOM_PAGE_SEGMENTS] }),
  });
};

const runOutcomeOf = (request: { readonly command: CommandRequest; readonly located: Located; readonly run: VersionTwoRun }): CommandOutcome => {
  const { report, catalogue, output } = request.run;
  return {
    code: runVerdictOf({ report }) === "pass" ? 0 : 1,
    text: renderRunReportText({
      report,
      catalogue,
      output,
      symptomPage: symptomPageOf(request),
      projectCommand: request.located.commands.project,
      pruneCommand: request.located.commands.prune,
    }),
  };
};

const failureOutcomeOf = (request: { readonly failure: RunLoadFailure }): CommandOutcome => ({
  code: LOAD_FAILURE_CODE,
  text: `${runLoadFailureLine({ failure: request.failure, upgradeCommand: undefined })}\n`,
});

const stagesOf = (request: VersionTwoCheckRequest & { readonly command: CommandRequest; readonly located: Located }): VersionTwoStages => {
  const { path, fileText, modules, git } = request.command;
  return request.stagesOver({
    ports: { fileText, path, modules, git, gitTree: request.gitTree, directory: request.directory },
    locations: {
      repoRoot: request.located.repoRoot,
      installRoot: request.located.installRoot,
      moduleExtension: moduleExtensionOf({ moduleUrl: request.command.moduleUrl }),
      baseRevision: request.located.arguments.baseRevision,
    },
  });
};

const outcomeOf = async (request: VersionTwoCheckRequest & { readonly command: CommandRequest }): Promise<CommandOutcome> => {
  const located = locatedOf(request);
  if (located.outcome === "failed") {
    return loadFailureOutcome({ failure: located.error });
  }
  const run = await versionTwoRunOver({
    stages: stagesOf({ ...request, located: located.value }),
    arguments: { forfeiture: located.value.arguments.forfeiture, reportOutput: located.value.arguments.reportOutput },
  });
  return run.outcome === "failed"
    ? failureOutcomeOf({ failure: run.error })
    : runOutcomeOf({ command: request.command, located: located.value, run: run.value });
};

export const versionTwoCheckCommandOf =
  (request: VersionTwoCheckRequest) =>
  async (command: CommandRequest): Promise<void> => {
    printOutcome({ process: command.process, outcome: await outcomeOf({ ...request, command }) });
  };
