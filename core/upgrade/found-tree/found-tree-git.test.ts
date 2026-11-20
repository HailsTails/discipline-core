import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../platform-ports/file-text-port.ts";
import type { GitPort } from "../../platform-ports/git-port.ts";
import { createPathPort } from "../../platform-ports/path-port.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import { foundTreeGitOf } from "./found-tree-git.ts";
import { FOUND_TREE_REVISION } from "./found-tree-reach.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const FILE = repoPathSchema.parse("src/a.ts");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const underlyingGit = (): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: [FILE] }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
});

const treeHolding = (request: { readonly text: string }): Pick<FileTextPort, "read"> => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
});

const treeLacking = (): Pick<FileTextPort, "read"> => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/src/a.ts", detail: "ENOENT" } }),
});

const foundTreeOver = (request: { readonly fileText: Pick<FileTextPort, "read"> }) => {
  const git = underlyingGit();
  return { git, found: foundTreeGitOf({ git, fileText: request.fileText, path: PATH }) };
};

const QUERY = { repoRoot: REPO_ROOT, baseRevision: FOUND_TREE_REVISION, file: FILE };

describe("foundTreeGitOf, git with the tree the upgrade found as its base", () => {
  it("reports nothing changed since the base, which is the tree itself, and never asks git", () => {
    const { found, git } = foundTreeOver({ fileText: treeLacking() });
    expect({ changed: found.changedSince({ repoRoot: REPO_ROOT, baseRevision: FOUND_TREE_REVISION }), asked: vi.mocked(git.changedSince).mock.calls }).toEqual({
      changed: { outcome: "ok", value: [] },
      asked: [],
    });
  });

  it("reads a file's text in the base from the working tree, at the file's place in the repository", () => {
    const fileText = treeHolding({ text: "export const a = 1;\n" });
    const { found } = foundTreeOver({ fileText });
    expect({ text: found.textInBase(QUERY), read: vi.mocked(fileText.read).mock.calls }).toEqual({
      text: { outcome: "ok", value: { presence: "present-in-base", text: "export const a = 1;\n" } },
      read: [[{ path: "/repo/src/a.ts" }]],
    });
  });

  it("reports a file the working tree lacks as absent from the base", () => {
    const { found } = foundTreeOver({ fileText: treeLacking() });
    expect(found.textInBase(QUERY)).toEqual({ outcome: "ok", value: { presence: "absent-from-base" } });
  });

  it("reports a file's membership in the base from the working tree", () => {
    const present = foundTreeOver({ fileText: treeHolding({ text: "x" }) });
    const absent = foundTreeOver({ fileText: treeLacking() });
    expect({ present: present.found.contentInBase(QUERY), absent: absent.found.contentInBase(QUERY) }).toEqual({
      present: { outcome: "ok", value: "present-in-base" },
      absent: { outcome: "ok", value: "absent-from-base" },
    });
  });

  it("leaves the tracked paths to the git it wraps", () => {
    const { found } = foundTreeOver({ fileText: treeLacking() });
    expect(found.trackedPaths({ repoRoot: REPO_ROOT })).toEqual({ outcome: "ok", value: [FILE] });
  });
});
