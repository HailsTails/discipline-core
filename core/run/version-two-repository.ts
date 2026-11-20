import { argumentsInvalid } from "../command-line/argument-problem.ts";
import { installRootOf } from "../command-line/install-root.ts";
import type { LoadFailure } from "../command-line/load-failure.ts";
import type { CommandRequest } from "../check/run-check-command.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { moduleExtensionOf } from "../values/install-layout.ts";
import type { Result } from "../values/result.ts";
import { type VersionTwoLocations, type VersionTwoPorts, versionTwoStagesOver } from "./version-two-stages.ts";
import type { VersionTwoStages } from "./version-two-run.ts";

export type StagesOver = (request: { readonly ports: VersionTwoPorts; readonly locations: VersionTwoLocations }) => VersionTwoStages;

export type VersionTwoRepositoryPorts = {
  readonly gitTree: VersionTwoPorts["gitTree"];
  readonly directory: VersionTwoPorts["directory"];
  readonly stagesOver: StagesOver;
};

export const installedStagesOver: StagesOver = versionTwoStagesOver;

export type RepositoryLocated = { readonly repoRoot: AbsolutePath; readonly installRoot: AbsolutePath };

export const repoRootOf = (request: { readonly command: CommandRequest; readonly repo: string }): Result<AbsolutePath, LoadFailure> => {
  const resolved = request.command.path.resolve({ path: request.repo });
  return resolved.outcome === "failed" ? argumentsInvalid({ problem: { kind: "repo-unresolvable", given: request.repo } }) : resolved;
};

export const repositoryLocatedOf = (request: { readonly command: CommandRequest; readonly repo: string }): Result<RepositoryLocated, LoadFailure> => {
  const { command } = request;
  const repoRoot = repoRootOf(request);
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf({ path: command.path, moduleUrl: command.moduleUrl });
  return installRoot.outcome === "failed" ? installRoot : { outcome: "ok", value: { repoRoot: repoRoot.value, installRoot: installRoot.value } };
};

export const stagesOverRepository = (request: {
  readonly ports: VersionTwoRepositoryPorts;
  readonly command: CommandRequest;
  readonly located: RepositoryLocated;
  readonly baseRevision: string | undefined;
}): VersionTwoStages => {
  const { path, fileText, modules, git } = request.command;
  return request.ports.stagesOver({
    ports: { fileText, path, modules, git, gitTree: request.ports.gitTree, directory: request.ports.directory },
    locations: {
      repoRoot: request.located.repoRoot,
      installRoot: request.located.installRoot,
      moduleExtension: moduleExtensionOf({ moduleUrl: request.command.moduleUrl }),
      baseRevision: request.baseRevision,
    },
  });
};
