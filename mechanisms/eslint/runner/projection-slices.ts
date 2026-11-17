import type { ExceptionRecord } from "../../../core/exception-records/exception-records.ts";
import type { EslintConfigLookup } from "../../../core/values/eslint-config-lookup.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import { CONFIG_FILE_NAMES } from "./config-lookup.ts";
import { PROJECTION_PATH } from "./projection.ts";

export type ConfigRoot =
  | { readonly placement: "repository" }
  | { readonly placement: "package"; readonly directory: RepoPath };

const SELECTION_FILE_NAME = "disciplines.json";

const REPOSITORY_ROOT: ConfigRoot = { placement: "repository" };

const directoryOf = (request: { readonly path: RepoPath }): string => request.path.split("/").slice(0, -1).join("/");

const fileNameOf = (request: { readonly path: RepoPath }): string => request.path.split("/").at(-1) ?? "";

const within = (request: { readonly path: string; readonly directory: string }): "within" | "outside" =>
  request.path === request.directory || request.path.startsWith(`${request.directory}/`) ? "within" : "outside";

const nestedRepositories = (request: { readonly trackedPaths: readonly RepoPath[] }): readonly string[] =>
  request.trackedPaths
    .filter((path) => fileNameOf({ path }) === SELECTION_FILE_NAME)
    .map((path) => directoryOf({ path }))
    .filter((directory) => directory !== "");

const insideNestedRepository = (request: {
  readonly directory: string;
  readonly nested: readonly string[];
}): "nested" | "own" =>
  request.nested.some((nested) => within({ path: request.directory, directory: nested }) === "within") ? "nested" : "own";

const codeUnitOrder = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
};

type RootsRequest = {
  readonly trackedPaths: readonly RepoPath[];
  readonly declared: readonly RepoPath[];
  readonly lookup: EslintConfigLookup;
};

const configuredDirectories = (request: RootsRequest): readonly string[] =>
  request.lookup === "nearest-to-file"
    ? request.trackedPaths.filter((path) => CONFIG_FILE_NAMES.includes(fileNameOf({ path }))).map((path) => directoryOf({ path }))
    : [];

const packageDirectories = (request: RootsRequest): readonly RepoPath[] => {
  const nested = nestedRepositories(request);
  const configured = configuredDirectories(request);
  return [...new Set([...configured, ...request.declared])]
    .filter((directory) => directory !== "")
    .filter((directory) => insideNestedRepository({ directory, nested }) === "own")
    .sort(codeUnitOrder)
    .map((directory) => repoPathSchema.parse(directory));
};

export const configRootsOf = (request: RootsRequest): readonly ConfigRoot[] => [
  REPOSITORY_ROOT,
  ...packageDirectories(request).map((directory): ConfigRoot => ({ placement: "package", directory })),
];

export const slicePathOf = (request: { readonly root: ConfigRoot }): RepoPath =>
  request.root.placement === "repository"
    ? PROJECTION_PATH
    : repoPathSchema.parse(`${request.root.directory}/${PROJECTION_PATH}`);

const packageRecord = (request: {
  readonly record: ExceptionRecord;
  readonly directory: RepoPath;
}): readonly ExceptionRecord[] => {
  const record = request.record;
  if (record.kind === "clause-wide-carve-out") {
    return [record];
  }
  return within({ path: record.file, directory: request.directory }) === "within"
    ? [{ ...record, file: repoPathSchema.parse(record.file.slice(request.directory.length + 1)) }]
    : [];
};

export const sliceRecordsOf = (request: {
  readonly root: ConfigRoot;
  readonly records: readonly ExceptionRecord[];
}): readonly ExceptionRecord[] => {
  const root = request.root;
  return root.placement === "repository"
    ? request.records
    : request.records.flatMap((record) => packageRecord({ record, directory: root.directory }));
};

export const packageFoldersOf = (request: { readonly roots: readonly ConfigRoot[] }): ReadonlySet<string> =>
  new Set(request.roots.flatMap((root) => (root.placement === "package" ? [root.directory] : [])));

export const governingPackageOf = (request: {
  readonly file: RepoPath;
  readonly packages: ReadonlySet<string>;
}): string | undefined => {
  const folders = request.file.split("/").slice(0, -1);
  return folders
    .map((_, index) => folders.slice(0, folders.length - index).join("/"))
    .find((folder) => request.packages.has(folder));
};

export const orphanedSliceDirectoriesOf = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly roots: readonly ConfigRoot[];
}): readonly RepoPath[] => {
  const nested = nestedRepositories(request);
  const rooted = new Set<string>(request.roots.flatMap((root) => (root.placement === "package" ? [root.directory] : [])));
  return request.trackedPaths
    .filter((path) => fileNameOf({ path }) === PROJECTION_PATH)
    .map((path) => directoryOf({ path }))
    .filter((directory) => directory !== "" && !rooted.has(directory))
    .filter((directory) => insideNestedRepository({ directory, nested }) === "own")
    .sort(codeUnitOrder)
    .map((directory) => repoPathSchema.parse(directory));
};
