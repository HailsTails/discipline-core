import type { FileTextPort } from "../../platform-ports/file-text-port.ts";
import type { PathPort } from "../../platform-ports/path-port.ts";
import type { AbsolutePath } from "../../values/absolute-path.ts";
import type { RepoPath } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import type { PlannedRepoFile } from "../proof/upgrade-plan.ts";
import { projectionImportingOf } from "../version-two-writer/config-import-rewrite.ts";

export type TeamConfigRefusal =
  | { readonly kind: "no-file-imports-projection"; readonly projection: RepoPath }
  | { readonly kind: "several-files-import-projection"; readonly projection: RepoPath; readonly files: readonly RepoPath[] }
  | { readonly kind: "config-candidate-unreadable"; readonly file: RepoPath; readonly detail: string };

export type TeamConfigRequest = {
  readonly repoRoot: AbsolutePath;
  readonly fileText: Pick<FileTextPort, "read">;
  readonly path: Pick<PathPort, "join">;
  readonly trackedPaths: readonly RepoPath[];
  readonly projection: RepoPath | undefined;
};

const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

const IN_NODE_MODULES = /(?:^|\/)node_modules\//;

const candidatesOf = (request: { readonly trackedPaths: readonly RepoPath[]; readonly projection: RepoPath }): readonly RepoPath[] =>
  request.trackedPaths.filter((file) => SCRIPT_FILE.test(file) && !IN_NODE_MODULES.test(file) && file !== request.projection);

const importingOf = (request: TeamConfigRequest & { readonly projection: RepoPath; readonly file: RepoPath }): Result<PlannedRepoFile | undefined, TeamConfigRefusal> => {
  const read = request.fileText.read({ path: request.path.join({ segments: [request.repoRoot, request.file] }) });
  if (read.outcome === "failed") {
    return { outcome: "failed", error: { kind: "config-candidate-unreadable", file: request.file, detail: read.error.detail } };
  }
  const importing = projectionImportingOf({ file: request.file, text: read.value, versionOneProjection: request.projection, versionTwoProjection: request.projection });
  return { outcome: "ok", value: importing === "imports" ? { file: request.file, text: read.value } : undefined };
};

export const teamConfigOf = (request: TeamConfigRequest): Result<PlannedRepoFile | undefined, TeamConfigRefusal> => {
  const { projection } = request;
  if (projection === undefined) {
    return { outcome: "ok", value: undefined };
  }
  const read = candidatesOf({ trackedPaths: request.trackedPaths, projection }).map((file) => importingOf({ ...request, projection, file }));
  const unreadable = read.find((each) => each.outcome === "failed");
  if (unreadable !== undefined) {
    return unreadable;
  }
  const importing = read.flatMap((each) => (each.outcome === "ok" && each.value !== undefined ? [each.value] : []));
  const [only, ...others] = importing;
  if (only === undefined) {
    return { outcome: "failed", error: { kind: "no-file-imports-projection", projection } };
  }
  return others.length === 0
    ? { outcome: "ok", value: only }
    : { outcome: "failed", error: { kind: "several-files-import-projection", projection, files: importing.map(({ file }) => file) } };
};
