import { describe, expect, it, vi } from "vitest";
import type { CheckRequest } from "../../check/run-check.ts";
import type { CommandRequest } from "../../check/run-check-command.ts";
import type { GitPort } from "../../platform-ports/git-port.ts";
import { createPathPort } from "../../platform-ports/path-port.ts";
import type { RecordsSource } from "../../records/records-source.ts";
import type { RecordsSourceOf } from "../../records/records-folder.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import type { ExceptionRepository } from "../version-one-records/exception-records.ts";
import { FOUND_TREE_REVISION, foundTreeCheckReachOf, foundTreeRunReachOf } from "./found-tree-reach.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const git = (): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
});

const fileText = (): CheckRequest["fileText"] => ({
  read: vi.fn<CheckRequest["fileText"]["read"]>(),
  exists: vi.fn<CheckRequest["fileText"]["exists"]>(),
});

const exceptions = (): ExceptionRepository => ({
  read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: [] }),
  readAt: vi.fn<ExceptionRepository["readAt"]>(),
  add: vi.fn<ExceptionRepository["add"]>(),
  remove: vi.fn<ExceptionRepository["remove"]>(),
  moveToSplitLayout: vi.fn<ExceptionRepository["moveToSplitLayout"]>(),
});

describe("foundTreeCheckReachOf", () => {
  it("measures a version 1 check against the tree the upgrade found: nothing changed since the base, and the entries at the base are the working tree's", () => {
    const underlying = exceptions();
    const reach = foundTreeCheckReachOf({ check: { git: git(), fileText: fileText(), path: PATH, exceptionRepository: underlying } });
    expect({
      baseRevision: reach.baseRevision,
      changed: reach.git.changedSince({ repoRoot: REPO_ROOT, baseRevision: FOUND_TREE_REVISION }),
      entriesAtBase: reach.exceptionRepository.readAt({ revision: FOUND_TREE_REVISION }),
      askedGit: vi.mocked(underlying.readAt).mock.calls,
    }).toEqual({
      baseRevision: FOUND_TREE_REVISION,
      changed: { outcome: "ok", value: [] },
      entriesAtBase: { outcome: "ok", value: [] },
      askedGit: [],
    });
  });
});

describe("foundTreeRunReachOf", () => {
  it("measures a version 2 run against the tree the upgrade found, with records at the base that never ask git", () => {
    const underlying = vi.fn<RecordsSourceOf>().mockReturnValue({
      read: vi.fn<RecordsSource["read"]>().mockReturnValue({ outcome: "ok", value: [] }),
      readAt: vi.fn<RecordsSource["readAt"]>(),
    });
    const command: Pick<CommandRequest, "git" | "path" | "exceptionRepositoryOf"> & { readonly fileText: CheckRequest["fileText"] } = {
      git: git(),
      fileText: fileText(),
      path: PATH,
      exceptionRepositoryOf: () => exceptions(),
    };
    const reach = foundTreeRunReachOf({ recordsSourceOf: underlying, command });
    expect({
      baseRevision: reach.baseRevision,
      changed: reach.git.changedSince({ repoRoot: REPO_ROOT, baseRevision: reach.baseRevision }),
    }).toEqual({ baseRevision: FOUND_TREE_REVISION, changed: { outcome: "ok", value: [] } });
  });
});
