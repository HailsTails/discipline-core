import type { FileTextPort } from "../../platform-ports/file-text-port.ts";
import type { PathPort } from "../../platform-ports/path-port.ts";
import type { AbsolutePath } from "../../values/absolute-path.ts";
import { gatheredOutcomes, listedOutcome } from "../../values/gathered-outcomes.ts";
import type { RepoPath } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import { projectionImportingOf } from "../version-two-writer/config-import-rewrite.ts";
import type { PlannedRepoFile } from "./planned-repo-file.ts";

export type VersionOneProjection = { readonly projection: RepoPath; readonly teamConfig: PlannedRepoFile };

export type TeamConfigRefusal =
  | { readonly kind: "no-file-imports-projection"; readonly projection: RepoPath }
  | { readonly kind: "several-files-import-projection"; readonly projection: RepoPath; readonly files: readonly RepoPath[] }
  | { readonly kind: "config-candidate-unreadable"; readonly file: RepoPath; readonly detail: string };

export type TeamConfigsRequest = {
  readonly repoRoot: AbsolutePath;
  readonly fileText: Pick<FileTextPort, "read">;
  readonly path: Pick<PathPort, "join">;
  readonly trackedPaths: readonly RepoPath[];
  readonly projections: readonly RepoPath[];
};

const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

const IN_NODE_MODULES = /(?:^|\/)node_modules\//;

const candidatesOf = (request: { readonly trackedPaths: readonly RepoPath[]; readonly projections: readonly RepoPath[] }): readonly RepoPath[] =>
  request.trackedPaths.filter((file) => SCRIPT_FILE.test(file) && !IN_NODE_MODULES.test(file) && !request.projections.includes(file));

const readCandidate = (request: TeamConfigsRequest & { readonly file: RepoPath }): Result<PlannedRepoFile, TeamConfigRefusal> => {
  const read = request.fileText.read({ path: request.path.join({ segments: [request.repoRoot, request.file] }) });
  return read.outcome === "failed"
    ? { outcome: "failed", error: { kind: "config-candidate-unreadable", file: request.file, detail: read.error.detail } }
    : { outcome: "ok", value: { file: request.file, text: read.value } };
};

const importersOf = (request: { readonly candidates: readonly PlannedRepoFile[]; readonly projection: RepoPath }): readonly PlannedRepoFile[] =>
  request.candidates.filter(
    (candidate) =>
      projectionImportingOf({ file: candidate.file, text: candidate.text, versionOneProjection: request.projection, versionTwoProjection: request.projection }) === "imports",
  );

const teamConfigFor = (request: { readonly candidates: readonly PlannedRepoFile[]; readonly projection: RepoPath }): Result<VersionOneProjection, TeamConfigRefusal> => {
  const { projection } = request;
  const importing = importersOf(request);
  const [only, ...others] = importing;
  if (only === undefined) {
    return { outcome: "failed", error: { kind: "no-file-imports-projection", projection } };
  }
  return others.length === 0
    ? { outcome: "ok", value: { projection, teamConfig: only } }
    : { outcome: "failed", error: { kind: "several-files-import-projection", projection, files: importing.map(({ file }) => file) } };
};

export const teamConfigsOf = (request: TeamConfigsRequest): Result<readonly VersionOneProjection[], TeamConfigRefusal> => {
  if (request.projections.length === 0) {
    return { outcome: "ok", value: [] };
  }
  const candidates = gatheredOutcomes({ outcomes: candidatesOf(request).map((file) => listedOutcome({ outcome: readCandidate({ ...request, file }) })) });
  if (candidates.outcome === "failed") {
    return candidates;
  }
  return gatheredOutcomes({
    outcomes: request.projections.map((projection) => listedOutcome({ outcome: teamConfigFor({ candidates: candidates.value, projection }) })),
  });
};
