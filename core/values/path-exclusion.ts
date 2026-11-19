import type { RepoPath } from "./repo-path.ts";

export type PathExclusion = "excluded" | "checked";

export const pathExclusionOf = (request: { readonly path: RepoPath; readonly excluded: readonly RepoPath[] }): PathExclusion =>
  request.excluded.some((excludedPath) => request.path === excludedPath || request.path.startsWith(`${excludedPath}/`))
    ? "excluded"
    : "checked";
