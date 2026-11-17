import type { BaseReadFailure, ChangeSetFailure, GitFailure, GitPort } from "../platform-ports/git-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { BaseRevisionAvailability, ChangeSetBase } from "../values/base-revision-availability.ts";
import type { RepoPath } from "../values/repo-path.ts";

export type TouchedSet =
  | { readonly measured: "yes"; readonly paths: ReadonlySet<RepoPath> }
  | { readonly measured: "no"; readonly base: ChangeSetBase }
  | { readonly measured: "elsewhere" };

const firstLineOf = (request: { readonly failure: GitFailure }): string =>
  request.failure.detail
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";

export const baseRevisionAvailabilityOf = (request: {
  readonly revision: string;
  readonly failure: BaseReadFailure;
}): BaseRevisionAvailability => {
  switch (request.failure.kind) {
    case "base-absent":
      return { state: "not-found", revision: request.revision };
    case "git-failed":
      return { state: "git-failed", revision: request.revision, gitMessage: firstLineOf({ failure: request.failure }) };
  }
};

const changeSetBaseOf = (request: { readonly revision: string; readonly failure: ChangeSetFailure }): ChangeSetBase => {
  switch (request.failure.kind) {
    case "no-merge-base":
      return { state: "no-merge-base", revision: request.revision, clone: request.failure.clone };
    case "base-absent":
    case "git-failed":
      return baseRevisionAvailabilityOf({ revision: request.revision, failure: request.failure });
  }
};

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
    return { measured: "no", base: changeSetBaseOf({ revision: request.baseRevision, failure: changed.error }) };
  }
  return { measured: "yes", paths: new Set(changed.value) };
};
