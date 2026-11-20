import type { LoadFailure } from "../../command-line/load-failure.ts";
import type { DirectoryEntry, DirectoryPort } from "../../platform-ports/file-system-port.ts";
import type { FileTextPort } from "../../platform-ports/file-text-port.ts";
import type { PathPort } from "../../platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import type { VersionOneRecordsRoot } from "../proof/upgrade-proof.ts";

const SINGLE_RECORDS_FILE = repoPathSchema.parse("discipline-exceptions.json");

const SPLIT_RECORDS_FOLDER = repoPathSchema.parse("discipline-exceptions");

const RECORDS_FILE_EXTENSION = ".json";

export type RecordsOnDisk = {
  readonly files: readonly RepoPath[];
  readonly folders: readonly RepoPath[];
  readonly root: VersionOneRecordsRoot;
};

export type RecordsOnDiskRequest = {
  readonly repoRoot: AbsolutePath;
  readonly fileText: Pick<FileTextPort, "exists">;
  readonly directory: Pick<DirectoryPort, "list">;
  readonly path: Pick<PathPort, "join">;
};

type Tree = { readonly files: readonly RepoPath[]; readonly folders: readonly RepoPath[] };

const NOTHING: Tree = { files: [], folders: [] };

const unreadable = (request: { readonly path: string; readonly detail: string }): Result<never, LoadFailure> => ({
  outcome: "failed",
  error: { kind: "file-unreadable", path: request.path, detail: request.detail },
});

const absoluteOf = (request: RecordsOnDiskRequest & { readonly shown: RepoPath }): Result<AbsolutePath, LoadFailure> => {
  const joined = request.path.join({ segments: [request.repoRoot, request.shown] });
  const parsed = absolutePathSchema.safeParse(joined);
  return parsed.success ? { outcome: "ok", value: parsed.data } : unreadable({ path: joined, detail: "not an absolute path" });
};

const joinedTrees = (request: { readonly trees: readonly Tree[] }): Tree => ({
  files: request.trees.flatMap(({ files }) => files),
  folders: request.trees.flatMap(({ folders }) => folders),
});

const allOk = (request: { readonly results: readonly Result<Tree, LoadFailure>[] }): Result<readonly Tree[], LoadFailure> => {
  const failed = request.results.find((result) => result.outcome === "failed");
  return failed ?? { outcome: "ok", value: request.results.flatMap((result) => (result.outcome === "ok" ? [result.value] : [])) };
};

const entryTreeOf = (request: RecordsOnDiskRequest & { readonly folder: RepoPath; readonly entry: DirectoryEntry }): Result<Tree, LoadFailure> => {
  const shown = repoPathSchema.parse(`${request.folder}/${request.entry.name}`);
  if (request.entry.kind === "directory") {
    return folderTreeOf({ ...request, folder: shown });
  }
  return { outcome: "ok", value: shown.endsWith(RECORDS_FILE_EXTENSION) ? { files: [shown], folders: [] } : NOTHING };
};

const folderTreeOf = (request: RecordsOnDiskRequest & { readonly folder: RepoPath }): Result<Tree, LoadFailure> => {
  const absolute = absoluteOf({ ...request, shown: request.folder });
  if (absolute.outcome === "failed") {
    return absolute;
  }
  const listed = request.directory.list({ path: absolute.value });
  if (listed.outcome === "failed") {
    return unreadable({ path: absolute.value, detail: listed.error.detail });
  }
  const below = allOk({ results: listed.value.map((entry) => entryTreeOf({ ...request, entry })) });
  return below.outcome === "failed" ? below : { outcome: "ok", value: joinedTrees({ trees: [{ files: [], folders: [request.folder] }, ...below.value] }) };
};

const presentOf = (request: RecordsOnDiskRequest & { readonly shown: RepoPath }): boolean => {
  const absolute = absoluteOf(request);
  return absolute.outcome === "ok" && request.fileText.exists({ path: absolute.value }) === "present";
};

export const recordsOnDiskOf = (request: RecordsOnDiskRequest): Result<RecordsOnDisk, LoadFailure> => {
  const single = presentOf({ ...request, shown: SINGLE_RECORDS_FILE });
  const split = presentOf({ ...request, shown: SPLIT_RECORDS_FOLDER });
  const tree = split ? folderTreeOf({ ...request, folder: SPLIT_RECORDS_FOLDER }) : { outcome: "ok" as const, value: NOTHING };
  if (tree.outcome === "failed") {
    return tree;
  }
  return {
    outcome: "ok",
    value: {
      files: [...(single ? [SINGLE_RECORDS_FILE] : []), ...tree.value.files],
      folders: tree.value.folders,
      root: single ? { kind: "repository" } : { kind: "folder", folder: SPLIT_RECORDS_FOLDER },
    },
  };
};
