import { describe, expect, it, vi } from "vitest";
import type { ChangeSetFailure, GitFailure, GitPort } from "../platform-ports/git-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import type { Equal } from "../values/type-equality.ts";
import { baseRevisionAvailabilityOf, computeTouchedSet, type TouchedSet } from "./touched-set.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");
const A = repoPathSchema.parse("a.ts");
const B = repoPathSchema.parse("src/b.md");

const FAILURE: GitFailure = {
  kind: "git-failed",
  command: "git diff --name-only -z HEAD",
  detail: "fatal: bad revision",
};

const okPaths = (): Result<readonly (typeof A)[], GitFailure> => ({
  outcome: "ok",
  value: [A, B, A],
});

const failed = (): Result<readonly (typeof A)[], GitFailure> => ({
  outcome: "failed",
  error: FAILURE,
});

const fakeGit = (changedSince: GitPort["changedSince"]): GitPort => ({
  trackedPaths: () => ({ outcome: "ok", value: [] }),
  changedSince,
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
});

const measuredMemberKeysArePaths: Equal<
  keyof Extract<TouchedSet, { readonly measured: "yes" }>,
  "measured" | "paths"
> = true;

describe("computeTouchedSet", () => {
  it("names the measured member's field paths", () => {
    expect(measuredMemberKeysArePaths).toBe(true);
  });

  it("measures the de-duplicated changed paths when a base revision is given", () => {
    const touched = computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: "abc123",
      git: fakeGit(okPaths),
    });

    expect(touched).toEqual({ measured: "yes", paths: new Set([A, B]) });
  });

  it("asks git for the changes since the given base under the given root", () => {
    const changedSince = vi.fn<GitPort["changedSince"]>().mockReturnValue(okPaths());

    computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: "abc123",
      git: fakeGit(changedSince),
    });

    expect(changedSince).toHaveBeenCalledWith({
      repoRoot: "/repo",
      baseRevision: "abc123",
    });
  });

  it("is unmeasured with no-base-revision when no base revision is given", () => {
    const touched = computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: undefined,
      git: fakeGit(okPaths),
    });

    expect(touched).toEqual({ measured: "no", base: { state: "not-given" } });
  });

  it("does not run git when no base revision is given", () => {
    const changedSince = vi.fn<GitPort["changedSince"]>().mockReturnValue(okPaths());

    computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: undefined,
      git: fakeGit(changedSince),
    });

    expect(changedSince).not.toHaveBeenCalled();
  });

  it("is unmeasured with the base git failed on, carrying git's own message, when git fails", () => {
    const touched = computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: "abc123",
      git: fakeGit(failed),
    });

    expect(touched).toEqual({
      measured: "no",
      base: { state: "git-failed", revision: "abc123", gitMessage: "fatal: bad revision" },
    });
  });

  it.each<readonly [ChangeSetFailure, TouchedSet]>([
    [{ kind: "base-absent" }, { measured: "no", base: { state: "not-found", revision: "abc123" } }],
    [
      { kind: "no-merge-base", clone: "shallow" },
      { measured: "no", base: { state: "no-merge-base", revision: "abc123", clone: "shallow" } },
    ],
    [
      { kind: "no-merge-base", clone: "complete" },
      { measured: "no", base: { state: "no-merge-base", revision: "abc123", clone: "complete" } },
    ],
  ])("is unmeasured with the base state git found for %o", (failure, touched) => {
    expect(
      computeTouchedSet({
        repoRoot: REPO_ROOT,
        baseRevision: "abc123",
        git: fakeGit(() => ({ outcome: "failed", error: failure })),
      }),
    ).toEqual(touched);
  });
});

describe("baseRevisionAvailabilityOf", () => {
  it("is not-found when the base names no commit in this clone", () => {
    expect(baseRevisionAvailabilityOf({ revision: "origin/main", failure: { kind: "base-absent" } })).toEqual({
      state: "not-found",
      revision: "origin/main",
    });
  });

  it("keeps the first line git wrote when git fails otherwise", () => {
    expect(
      baseRevisionAvailabilityOf({
        revision: "HEAD",
        failure: {
          kind: "git-failed",
          command: "git ls-tree",
          detail: "\n  fatal: path 'pkg/discipline-exceptions.json' does not exist in 'HEAD'  \nhint: more\n",
        },
      }),
    ).toEqual({
      state: "git-failed",
      revision: "HEAD",
      gitMessage: "fatal: path 'pkg/discipline-exceptions.json' does not exist in 'HEAD'",
    });
  });

  it("keeps an empty message when git wrote none", () => {
    expect(
      baseRevisionAvailabilityOf({ revision: "HEAD", failure: { kind: "git-failed", command: "git ls-tree", detail: "" } }),
    ).toEqual({ state: "git-failed", revision: "HEAD", gitMessage: "" });
  });
});
