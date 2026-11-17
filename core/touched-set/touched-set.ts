import type { GitFailure, GitPort } from "../platform-ports/git-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { BaseRevisionAvailability } from "../values/base-revision-availability.ts";
import type { RepoPath } from "../values/repo-path.ts";

export type TouchedSet =
  | { readonly measured: "yes"; readonly paths: ReadonlySet<RepoPath> }
  | { readonly measured: "no"; readonly base: BaseRevisionAvailability }
  | { readonly measured: "elsewhere" };

const firstLineOf = (request: { readonly failure: GitFailure }): string =>
  request.failure.detail
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";

export const baseRevisionAvailabilityOf = (request: {
  readonly revision: string;
  readonly failure: GitFailure;
}): BaseRevisionAvailability => ({
  state: "git-failed",
  revision: request.revision,
  gitMessage: firstLineOf({ failure: request.failure }),
});

export const computeTouchedSet = (request: {
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: GitPort;
}): TouchedSet => {
  if (request.baseRevision === undefined) {
    return { measured: "no", base: { state: "not-given" } };
  }
  const changed = request.git.changedSince({
    repoRoot: request.repoRoot,
    baseRevision: request.baseRevision,
  });
  if (changed.outcome === "failed") {
    return { measured: "no", base: baseRevisionAvailabilityOf({ revision: request.baseRevision, failure: changed.error }) };
  }
  return { measured: "yes", paths: new Set(changed.value) };
};
