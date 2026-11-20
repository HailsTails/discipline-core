import type { RepoPath } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import { directoryOf, relativeSpecifierOf, resolvedPathOf } from "./relative-specifier.ts";

export type ConfigImportRefusal =
  | { readonly kind: "no-projection-import"; readonly file: RepoPath }
  | { readonly kind: "several-projection-imports"; readonly file: RepoPath; readonly count: number }
  | { readonly kind: "projection-named-elsewhere"; readonly file: RepoPath };

export type ConfigImportRewriteRequest = {
  readonly file: RepoPath;
  readonly text: string;
  readonly versionOneProjection: RepoPath;
  readonly versionTwoProjection: RepoPath;
};

type ProjectionImport = { readonly specifierStart: number; readonly specifier: string };

const STATIC_DEFAULT_IMPORT = /\bimport\s+[A-Za-z_$][\w$]*\s+from\s+(["'])(\.{1,2}\/[^"'\n]*)\1/g;

const PATH_SEPARATOR = "/";

const QUOTE_LENGTH = 1;

const importsOf = (request: { readonly text: string }): readonly ProjectionImport[] =>
  [...request.text.matchAll(STATIC_DEFAULT_IMPORT)].map((found) => ({
    specifierStart: found.index + found[0].length - found[2].length - QUOTE_LENGTH,
    specifier: found[2],
  }));

const projectionImportsOf = (request: ConfigImportRewriteRequest): readonly ProjectionImport[] =>
  importsOf({ text: request.text }).filter(
    ({ specifier }) => resolvedPathOf({ directory: directoryOf({ file: request.file }), specifier }) === request.versionOneProjection,
  );

const mentionsOf = (request: { readonly text: string; readonly name: string }): number => request.text.split(request.name).length - 1;

const nameOf = (request: { readonly path: RepoPath }): string => request.path.split(PATH_SEPARATOR).at(-1) ?? request.path;

export const rewrittenConfigOf = (request: ConfigImportRewriteRequest): Result<string, ConfigImportRefusal> => {
  const found = projectionImportsOf(request);
  const [only, ...others] = found;
  if (only === undefined) {
    return { outcome: "failed", error: { kind: "no-projection-import", file: request.file } };
  }
  if (others.length > 0) {
    return { outcome: "failed", error: { kind: "several-projection-imports", file: request.file, count: found.length } };
  }
  if (mentionsOf({ text: request.text, name: nameOf({ path: request.versionOneProjection }) }) > 1) {
    return { outcome: "failed", error: { kind: "projection-named-elsewhere", file: request.file } };
  }
  const specifier = relativeSpecifierOf({ directory: directoryOf({ file: request.file }), target: request.versionTwoProjection });
  return {
    outcome: "ok",
    value: `${request.text.slice(0, only.specifierStart)}${specifier}${request.text.slice(only.specifierStart + only.specifier.length)}`,
  };
};
