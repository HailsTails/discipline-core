import { argumentsInvalid } from "../check/argument-problem.ts";
import { type CheckArguments, parseCheckArguments } from "../check/command-arguments.ts";
import type { CommandOutcome } from "../check/command-outcome.ts";
import { installRootOf } from "../check/install-root.ts";
import type { LoadFailure } from "../check/load-failure.ts";
import { packageLinkOf } from "../check/package-link.ts";
import { type CommandRequest, printOutcome } from "../check/run-check-command.ts";
import { shownPathOf } from "../check/shown-path.ts";
import { projectCommandOf, pruneCommandOf, upgradeCommandOf } from "../check/tool-invocations.ts";
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

const UPGRADE_NOT_YET_KNOWN = "";

export type StagesOver = (request: { readonly ports: VersionTwoPorts; readonly locations: VersionTwoLocations }) => VersionTwoStages;

export type VersionTwoCheckRequest = {
  readonly gitTree: VersionTwoPorts["gitTree"];
  readonly directory: VersionTwoPorts["directory"];
  readonly stagesOver: StagesOver;
};

export const installedStagesOver: StagesOver = versionTwoStagesOver;

type Commands = { readonly project: string; readonly prune: string; readonly upgrade: string };

type Located = {
  readonly arguments: CheckArguments;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly commands: Commands;
};

const runFailureOfLoad = (request: { readonly failure: LoadFailure }): RunLoadFailure => {
  const { failure } = request;
  return failure.kind === "arguments-invalid" || failure.kind === "install-root-unresolvable" ? failure : { kind: "unexpected-error", detail: failure.kind };
};

const failedAs = (request: { readonly failure: LoadFailure }): Result<never, RunLoadFailure> => ({
  outcome: "failed",
  error: runFailureOfLoad(request),
});

const commandsOf = (request: { readonly command: CommandRequest; readonly arguments: CheckArguments; readonly repoRoot: AbsolutePath }): Result<Commands, LoadFailure> => {
  const { path, moduleUrl } = request.command;
  const invocation = { path, moduleUrl, repoRoot: request.repoRoot };
  const project = projectCommandOf(invocation);
  if (project.outcome === "failed") {
    return project;
  }
  const prune = pruneCommandOf({ ...invocation, baseRevision: request.arguments.baseRevision, forfeiture: request.arguments.forfeiture });
  if (prune.outcome === "failed") {
    return prune;
  }
  const upgrade = upgradeCommandOf(invocation);
  return upgrade.outcome === "failed" ? upgrade : { outcome: "ok", value: { project: project.value, prune: prune.value, upgrade: upgrade.value } };
};

const locatedOf = (request: { readonly command: CommandRequest }): Result<Located, RunLoadFailure> => {
  const { command } = request;
  const parsed = parseCheckArguments({ arguments: command.process.arguments });
  if (parsed.outcome === "failed") {
    return failedAs({ failure: parsed.error });
  }
  const resolved = command.path.resolve({ path: parsed.value.repo });
  if (resolved.outcome === "failed") {
    const refused = argumentsInvalid({ problem: { kind: "repo-unresolvable", given: parsed.value.repo } });
    return failedAs({ failure: refused.error });
  }
  const installRoot = installRootOf({ path: command.path, moduleUrl: command.moduleUrl });
  if (installRoot.outcome === "failed") {
    return failedAs({ failure: installRoot.error });
  }
  const commands = commandsOf({ command, arguments: parsed.value, repoRoot: resolved.value });
  return commands.outcome === "failed"
    ? failedAs({ failure: commands.error })
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

const failureOutcomeOf = (request: { readonly failure: RunLoadFailure; readonly upgradeCommand: string }): CommandOutcome => ({
  code: LOAD_FAILURE_CODE,
  text: `${runLoadFailureLine(request)}\n`,
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
    return failureOutcomeOf({ failure: located.error, upgradeCommand: UPGRADE_NOT_YET_KNOWN });
  }
  const run = await versionTwoRunOver({
    stages: stagesOf({ ...request, located: located.value }),
    arguments: { forfeiture: located.value.arguments.forfeiture, reportOutput: located.value.arguments.reportOutput },
  });
  return run.outcome === "failed"
    ? failureOutcomeOf({ failure: run.error, upgradeCommand: located.value.commands.upgrade })
    : runOutcomeOf({ command: request.command, located: located.value, run: run.value });
};

export const versionTwoCheckCommandOf =
  (request: VersionTwoCheckRequest) =>
  async (command: CommandRequest): Promise<void> => {
    printOutcome({ process: command.process, outcome: await outcomeOf({ ...request, command }) });
  };
