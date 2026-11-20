import { type CheckArguments, parseCheckArguments } from "../command-line/command-arguments.ts";
import { type CommandOutcome, loadFailureOutcome } from "../command-line/command-outcome.ts";
import type { LoadFailure } from "../command-line/load-failure.ts";
import { packageLinkOf } from "../command-line/package-link.ts";
import { printOutcome } from "../command-line/print-outcome.ts";
import { shownPathOf } from "../command-line/shown-path.ts";
import { projectCommandOf, pruneCommandOf } from "../command-line/tool-invocations.ts";
import type { CommandRequest } from "../check/run-check-command.ts";
import { renderRunReportText } from "../report/run-report-text.ts";
import { runVerdictOf } from "../report/report-sections.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import { runLoadFailureOutcomeOf, upgradeCommandFor } from "./run-load-failure-outcome.ts";
import { type RepositoryLocated, repositoryLocatedOf, stagesOverRepository, type VersionTwoRepositoryPorts } from "./version-two-repository.ts";
import { type VersionTwoRun, versionTwoRunOver } from "./version-two-run.ts";

const SYMPTOM_PAGE_SEGMENTS: readonly string[] = ["rules", "typescript", "symptoms.md"];

type Commands = { readonly project: string; readonly prune: string };

type Located = RepositoryLocated & {
  readonly arguments: CheckArguments;
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
  const located = repositoryLocatedOf({ command, repo: parsed.value.repo });
  if (located.outcome === "failed") {
    return located;
  }
  const commands = commandsOf({ command, arguments: parsed.value, repoRoot: located.value.repoRoot });
  return commands.outcome === "failed" ? commands : { outcome: "ok", value: { ...located.value, arguments: parsed.value, commands: commands.value } };
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

const outcomeOf = async (request: { readonly ports: VersionTwoRepositoryPorts; readonly command: CommandRequest }): Promise<CommandOutcome> => {
  const located = locatedOf(request);
  if (located.outcome === "failed") {
    return loadFailureOutcome({ failure: located.error });
  }
  const run = await versionTwoRunOver({
    stages: stagesOverRepository({ ...request, located: located.value, baseRevision: located.value.arguments.baseRevision }),
    arguments: { forfeiture: located.value.arguments.forfeiture, reportOutput: located.value.arguments.reportOutput, measuring: "when-debt-held" },
  });
  return run.outcome === "failed"
    ? runLoadFailureOutcomeOf({ failure: run.error, upgradeCommand: upgradeCommandFor({ path: request.command.path, moduleUrl: request.command.moduleUrl, repoRoot: located.value.repoRoot }) })
    : runOutcomeOf({ command: request.command, located: located.value, run: run.value });
};

export const versionTwoCheckCommandOf =
  (ports: VersionTwoRepositoryPorts) =>
  async (command: CommandRequest): Promise<void> => {
    printOutcome({ process: command.process, outcome: await outcomeOf({ ports, command }) });
  };
