import type { EslintConfigLookup } from "../../../core/values/eslint-config-lookup.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import { packageConfigFilesOf } from "./checks-config-roots.ts";
import { directoryOf } from "./checks-paths.ts";
import { type AnsweredFile, CHECKS_PROJECTION_PATH } from "./checks-projection.ts";

export type ChecksSlice = { readonly directory: RepoPath | undefined; readonly file: RepoPath };

const ROOT_SLICE: ChecksSlice = { directory: undefined, file: CHECKS_PROJECTION_PATH };

const packageSliceOf = (request: { readonly directory: string }): ChecksSlice => ({
  directory: repoPathSchema.parse(request.directory),
  file: repoPathSchema.parse(`${request.directory}/${CHECKS_PROJECTION_PATH}`),
});

export const slicesOf = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly declared: readonly RepoPath[];
  readonly lookup: EslintConfigLookup;
  readonly nestedRepositories: readonly string[];
}): readonly ChecksSlice[] => [
  ROOT_SLICE,
  ...[...new Set([...packageConfigFilesOf(request).map((path) => directoryOf({ path })), ...request.declared])]
    .toSorted()
    .map((directory) => packageSliceOf({ directory })),
];

export const answeredWithin = (request: { readonly answered: readonly AnsweredFile[]; readonly slice: ChecksSlice }): readonly AnsweredFile[] => {
  const { directory } = request.slice;
  if (directory === undefined) {
    return request.answered;
  }
  const prefix = `${directory}/`;
  return request.answered.flatMap((answer) => (answer.file.startsWith(prefix) ? [{ ...answer, file: repoPathSchema.parse(answer.file.slice(prefix.length)) }] : []));
};
