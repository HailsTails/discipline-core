import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import { checkedTreeOf } from "./checked-tree-of.ts";

const REPO = absolutePathSchema.parse("/repo");

const A = repoPathSchema.parse("src/a.ts");

const PACKAGES_WEB = repoPathSchema.parse("packages/web");

const DIST_B = repoPathSchema.parse("dist/b.ts");

const WEB_X = repoPathSchema.parse("packages/web/x.ts");

const DIST = repoPathSchema.parse("dist");

const POSIX = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const trackedByGit = (request: { readonly tracked: readonly RepoPath[] }): Pick<GitPort, "trackedPaths"> => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: request.tracked }),
});

const ALL_PRESENT: Pick<FileTextPort, "exists"> = { exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present") };

const treeOver = (request: { readonly tracked: readonly RepoPath[]; readonly excluded: readonly RepoPath[]; readonly roots: readonly RepoPath[] }) =>
  checkedTreeOf({
    git: trackedByGit(request),
    fileText: ALL_PRESENT,
    path: POSIX,
    repoRoot: REPO,
    excluded: request.excluded,
    eslintConfigRoots: request.roots,
  });

describe("checkedTreeOf", () => {
  it("gives the tracked files that are present and not excluded, and the declared config roots", () => {
    expect(treeOver({ tracked: [A, DIST_B, WEB_X], excluded: [DIST], roots: [PACKAGES_WEB] })).toEqual({
      outcome: "ok",
      value: { tracked: [A, WEB_X], declaredConfigRoots: [PACKAGES_WEB] },
    });
  });

  it("leaves out a tracked file that is not on disk", () => {
    const absent: Pick<FileTextPort, "exists"> = { exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent") };
    expect(
      checkedTreeOf({ git: trackedByGit({ tracked: [A] }), fileText: absent, path: POSIX, repoRoot: REPO, excluded: [], eslintConfigRoots: [] }),
    ).toEqual({ outcome: "ok", value: { tracked: [], declaredConfigRoots: [] } });
  });

  it("fails as a git failure when git cannot list the tracked files", () => {
    const failing: Pick<GitPort, "trackedPaths"> = {
      trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "failed", error: { kind: "git-failed", command: "git ls-files", detail: "not a repository" } }),
    };
    expect(checkedTreeOf({ git: failing, fileText: ALL_PRESENT, path: POSIX, repoRoot: REPO, excluded: [], eslintConfigRoots: [] })).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", detail: "git ls-files: not a repository" },
    });
  });

  it("fails naming a declared config root that holds no tracked file", () => {
    expect(treeOver({ tracked: [A], excluded: [], roots: [PACKAGES_WEB] })).toEqual({
      outcome: "failed",
      error: { kind: "config-root-untracked", root: PACKAGES_WEB },
    });
  });
});
