import type { CheckRequest } from "../../check/run-check.ts";
import { runProject } from "../../check/run-project.ts";
import { loadFailureDetail } from "../../command-line/load-failure-text.ts";
import type { FileTextPort } from "../../platform-ports/file-system-port.ts";
import type { PathPort } from "../../platform-ports/path-port.ts";
import type { AbsolutePath } from "../../values/absolute-path.ts";
import type { RepoPath } from "../../values/repo-path.ts";
import { teamConfigsOf } from "../proof/team-config-finder.ts";
import { type VersionOneProjectionsOf, versionOneProjectionsOver } from "../proof/version-one-projections-reading.ts";

export type VersionOneProjectionsRequest = {
  readonly check: CheckRequest;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
};

export const versionOneProjectionsOfRepository = (request: VersionOneProjectionsRequest): VersionOneProjectionsOf =>
  versionOneProjectionsOver({
    project: async () => {
      const projected = await runProject({ ...request.check, fileText: request.fileText });
      return projected.outcome === "failed" ? { outcome: "failed", error: { detail: loadFailureDetail({ failure: projected.error }) } } : projected;
    },
    teamConfigsOf: ({ projections }) =>
      teamConfigsOf({ repoRoot: request.repoRoot, fileText: request.fileText, path: request.path, trackedPaths: request.trackedPaths, projections }),
  });
