import type { EslintConfigLookup } from "../../../core/values/eslint-config-lookup.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import { CONFIG_FILE_NAMES } from "./config-lookup.ts";

const fileNameOf = (request: { readonly path: RepoPath }): string => request.path.split("/").at(-1) ?? "";

const directoryOf = (request: { readonly path: RepoPath }): string => request.path.split("/").slice(0, -1).join("/");

export const configuredDirectoriesOf = (request: { readonly trackedPaths: readonly RepoPath[]; readonly lookup: EslintConfigLookup }): readonly string[] =>
  request.lookup === "nearest-to-file"
    ? request.trackedPaths.filter((path) => CONFIG_FILE_NAMES.includes(fileNameOf({ path }))).map((path) => directoryOf({ path }))
    : [];

export const packageConfigRootCountOf = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly declared: readonly RepoPath[];
  readonly lookup: EslintConfigLookup;
}): number => new Set([...configuredDirectoriesOf(request), ...request.declared].filter((directory) => directory !== "")).size;
