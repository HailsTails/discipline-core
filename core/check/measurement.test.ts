import { describe, expect, it, vi } from "vitest";
import { CAUSAL_WHY_CHAIN, LEGACY_WHY_CHAIN } from "../../tests/causal-why-chain.ts";
import type {
  ExceptionBaseline,
  ExceptionRecord,
  ExceptionRepository,
  StructuralExceptionEntry,
} from "../exception-records/exception-records.ts";
import type { BaseFileText, GitFailure, GitPort } from "../platform-ports/git-port.ts";
import type { TouchedSet } from "../touched-set/touched-set.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import { exceptionBaselineOf, partialAssessmentsOf, touchedSetFor, unmeasuredOf } from "./measurement.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const CLASS_SYNTAX = clauseAddressSchema.parse("CD-14#class-syntax");

const AUDIT = mechanismIdSchema.parse("audit");

const LEGACY_FILE = repoPathSchema.parse("src/legacy.ts");

const LEGACY_SOURCE_FILE = repoPathSchema.parse(".constitution-authorised-locations/cd-14.json");

const FILE_CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: LEGACY_FILE,
  reason: "legacy class awaiting paydown",
  whyChain: CAUSAL_WHY_CHAIN,
};

const REASON_ONLY_CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: LEGACY_FILE,
  reason: "legacy class awaiting paydown",
};

const AUTHORISED_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/factory.ts"),
  reason: "the wrapping factory for the library",
  whyChain: CAUSAL_WHY_CHAIN,
};

const REASON_ONLY_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/factory.ts"),
  reason: "the wrapping factory for the library",
};

const IMPORTED_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/factory.ts"),
  reason: "the wrapping factory for the library",
  provenance: { kind: "existing-authorisation", source: ".constitution-authorised-locations/cd-14.json#0" },
};

const LEGACY_CHAIN_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/factory.ts"),
  reason: "the wrapping factory for the library",
  whyChain: LEGACY_WHY_CHAIN,
};

const CLAUSE_WIDE_CARVE_OUT: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  reason: "class syntax carved out during migration",
  whyChain: CAUSAL_WHY_CHAIN,
};

const CARVE_OUT_ENTRY: StructuralExceptionEntry = {
  kind: "file-carve-out",
  clause: "CD-14#class-syntax",
  file: "src/legacy.ts",
  reason: "legacy class awaiting paydown",
  whyChain: CAUSAL_WHY_CHAIN,
};

const REASON_ONLY_LOCATION_ENTRY: StructuralExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "the wrapping factory for the library",
};

const IMPORTED_LOCATION_ENTRY: StructuralExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "the wrapping factory for the library",
  provenance: { kind: "existing-authorisation", source: ".constitution-authorised-locations/cd-14.json#0" },
};

const LEGACY_CHAIN_ENTRY: StructuralExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "the wrapping factory for the library",
  whyChain: LEGACY_WHY_CHAIN,
};

const GIT_FAILURE: GitFailure = { kind: "git-failed", command: "git ls-tree", detail: "fatal: not a tree object" };

const UNMEASURED_NOT_GIVEN = { measured: "no", base: { state: "not-given" } } as const;

const UNMEASURED_GIT_FAILED = {
  measured: "no",
  base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" },
} as const;

const MEASURED_NOTHING_TOUCHED: TouchedSet = { measured: "yes", paths: new Set() };

const MEASURED_BASELINE: ExceptionBaseline = { measured: "yes", entriesAtBase: [], sourceTextsAtBase: new Map() };

const gitAnswering = (request: {
  readonly changedSince: Result<readonly RepoPath[], GitFailure>;
  readonly textInBase: Result<BaseFileText, GitFailure>;
}): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue(request.changedSince),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>().mockReturnValue(request.textInBase),
});

const exceptionRepositoryAnswering = (
  answer: ReturnType<ExceptionRepository["readAt"]>,
): Pick<ExceptionRepository, "readAt"> => ({
  readAt: vi.fn<ExceptionRepository["readAt"]>().mockReturnValue(answer),
});

describe("unmeasuredOf", () => {
  it("lists forfeiture-unmeasured when no base revision is given and a file carve-out exists", () => {
    expect(
      unmeasuredOf({ touched: UNMEASURED_NOT_GIVEN, exceptionBaseline: MEASURED_BASELINE, records: [FILE_CARVE_OUT] }),
    ).toEqual([{ kind: "forfeiture-unmeasured", base: { state: "not-given" } }]);
  });

  it("lists forfeiture-unmeasured with git's message when git cannot measure the change set and a file carve-out exists", () => {
    expect(
      unmeasuredOf({ touched: UNMEASURED_GIT_FAILED, exceptionBaseline: MEASURED_BASELINE, records: [FILE_CARVE_OUT] }),
    ).toEqual([
      { kind: "forfeiture-unmeasured", base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" } },
    ]);
  });

  it("lists forfeiture-unmeasured for a reason-only file carve-out", () => {
    expect(
      unmeasuredOf({ touched: UNMEASURED_NOT_GIVEN, exceptionBaseline: MEASURED_BASELINE, records: [REASON_ONLY_CARVE_OUT] }),
    ).toEqual([{ kind: "forfeiture-unmeasured", base: { state: "not-given" } }]);
  });

  it("lists nothing when the change set is unmeasured and no file carve-out exists", () => {
    expect(
      unmeasuredOf({
        touched: UNMEASURED_NOT_GIVEN,
        exceptionBaseline: MEASURED_BASELINE,
        records: [AUTHORISED_LOCATION, REASON_ONLY_LOCATION, CLAUSE_WIDE_CARVE_OUT],
      }),
    ).toEqual([]);
  });

  it("lists nothing when the change set is measured and a file carve-out exists", () => {
    expect(
      unmeasuredOf({ touched: MEASURED_NOTHING_TOUCHED, exceptionBaseline: MEASURED_BASELINE, records: [FILE_CARVE_OUT] }),
    ).toEqual([]);
  });

  it("lists no forfeiture-unmeasured when forfeiture is assessed elsewhere", () => {
    expect(
      unmeasuredOf({ touched: { measured: "elsewhere" }, exceptionBaseline: MEASURED_BASELINE, records: [FILE_CARVE_OUT] }),
    ).toEqual([]);
  });

  it("lists import-unmeasured when the exception baseline is unmeasured and an imported record exists", () => {
    expect(
      unmeasuredOf({ touched: MEASURED_NOTHING_TOUCHED, exceptionBaseline: UNMEASURED_GIT_FAILED, records: [IMPORTED_LOCATION] }),
    ).toEqual([
      { kind: "import-unmeasured", base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" } },
    ]);
  });

  it("lists legacy-chain-unmeasured when the exception baseline is unmeasured and a record holds a legacy chain", () => {
    expect(
      unmeasuredOf({ touched: MEASURED_NOTHING_TOUCHED, exceptionBaseline: UNMEASURED_NOT_GIVEN, records: [LEGACY_CHAIN_LOCATION] }),
    ).toEqual([{ kind: "legacy-chain-unmeasured", base: { state: "not-given" } }]);
  });

  it("lists no import or legacy-chain kind when the exception baseline is measured", () => {
    expect(
      unmeasuredOf({
        touched: MEASURED_NOTHING_TOUCHED,
        exceptionBaseline: MEASURED_BASELINE,
        records: [IMPORTED_LOCATION, LEGACY_CHAIN_LOCATION],
      }),
    ).toEqual([]);
  });

  it("lists forfeiture, import and legacy-chain unmeasured together, in that order", () => {
    expect(
      unmeasuredOf({
        touched: UNMEASURED_NOT_GIVEN,
        exceptionBaseline: UNMEASURED_NOT_GIVEN,
        records: [LEGACY_CHAIN_LOCATION, IMPORTED_LOCATION, FILE_CARVE_OUT],
      }),
    ).toEqual([
      { kind: "forfeiture-unmeasured", base: { state: "not-given" } },
      { kind: "import-unmeasured", base: { state: "not-given" } },
      { kind: "legacy-chain-unmeasured", base: { state: "not-given" } },
    ]);
  });
});

describe("touchedSetFor", () => {
  it("measures the change set once against the base revision when a file carve-out exists", () => {
    const git = gitAnswering({ changedSince: { outcome: "ok", value: [LEGACY_FILE] }, textInBase: { outcome: "failed", error: GIT_FAILURE } });
    expect(
      touchedSetFor({
        check: { assessment: { forfeiture: "this-run" }, repoRoot: REPO_ROOT, baseRevision: "main", git },
        records: [FILE_CARVE_OUT],
      }),
    ).toEqual({ measured: "yes", paths: new Set([LEGACY_FILE]) });
    expect(vi.mocked(git.changedSince).mock.calls).toEqual([[{ repoRoot: REPO_ROOT, baseRevision: "main" }]]);
  });

  it("does not measure the change set when no file carve-out exists", () => {
    const git = gitAnswering({ changedSince: { outcome: "ok", value: [] }, textInBase: { outcome: "failed", error: GIT_FAILURE } });
    expect(
      touchedSetFor({
        check: { assessment: { forfeiture: "this-run" }, repoRoot: REPO_ROOT, baseRevision: "main", git },
        records: [AUTHORISED_LOCATION, CLAUSE_WIDE_CARVE_OUT],
      }),
    ).toEqual({ measured: "yes", paths: new Set() });
    expect(git.changedSince).not.toHaveBeenCalled();
  });

  it("is unmeasured without asking git when a file carve-out exists and no base revision is given", () => {
    const git = gitAnswering({ changedSince: { outcome: "ok", value: [] }, textInBase: { outcome: "failed", error: GIT_FAILURE } });
    expect(
      touchedSetFor({
        check: { assessment: { forfeiture: "this-run" }, repoRoot: REPO_ROOT, baseRevision: undefined, git },
        records: [FILE_CARVE_OUT],
      }),
    ).toEqual({ measured: "no", base: { state: "not-given" } });
    expect(git.changedSince).not.toHaveBeenCalled();
  });

  it("never asks git for the change set when forfeiture is assessed elsewhere", () => {
    const git = gitAnswering({ changedSince: { outcome: "ok", value: [] }, textInBase: { outcome: "failed", error: GIT_FAILURE } });
    expect(
      touchedSetFor({
        check: { assessment: { forfeiture: "elsewhere" }, repoRoot: REPO_ROOT, baseRevision: "main", git },
        records: [FILE_CARVE_OUT],
      }),
    ).toEqual({ measured: "elsewhere" });
    expect(git.changedSince).not.toHaveBeenCalled();
  });
});

describe("partialAssessmentsOf", () => {
  it("reports the file carve-outs it did not check for decay when forfeiture is assessed elsewhere", () => {
    expect(
      partialAssessmentsOf({
        assessment: { forfeiture: "elsewhere" },
        records: [FILE_CARVE_OUT, AUTHORISED_LOCATION, REASON_ONLY_CARVE_OUT, CLAUSE_WIDE_CARVE_OUT],
      }),
    ).toEqual([{ concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 2 }]);
  });

  it("reports forfeiture elsewhere with no file carve-outs when none exists", () => {
    expect(partialAssessmentsOf({ assessment: { forfeiture: "elsewhere" }, records: [AUTHORISED_LOCATION] })).toEqual([
      { concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 0 },
    ]);
  });

  it("reports no assessment when forfeiture is assessed in this run", () => {
    expect(partialAssessmentsOf({ assessment: { forfeiture: "this-run" }, records: [FILE_CARVE_OUT] })).toEqual([]);
  });
});

describe("exceptionBaselineOf", () => {
  it("is unmeasured and reads nothing when no base revision is given", () => {
    const git = gitAnswering({ changedSince: { outcome: "ok", value: [] }, textInBase: { outcome: "failed", error: GIT_FAILURE } });
    const exceptionRepository = exceptionRepositoryAnswering({ outcome: "ok", value: [] });
    expect(
      exceptionBaselineOf({
        check: { repoRoot: REPO_ROOT, baseRevision: undefined, git, exceptionRepository },
        entries: [IMPORTED_LOCATION_ENTRY, LEGACY_CHAIN_ENTRY],
      }),
    ).toEqual({ measured: "no", base: { state: "not-given" } });
    expect({ readAt: vi.mocked(exceptionRepository.readAt).mock.calls, textInBase: vi.mocked(git.textInBase).mock.calls }).toEqual({
      readAt: [],
      textInBase: [],
    });
  });

  it("reads nothing at the base revision when no entry is imported or holds a legacy chain", () => {
    const git = gitAnswering({ changedSince: { outcome: "ok", value: [] }, textInBase: { outcome: "failed", error: GIT_FAILURE } });
    const exceptionRepository = exceptionRepositoryAnswering({ outcome: "ok", value: [] });
    expect(
      exceptionBaselineOf({
        check: { repoRoot: REPO_ROOT, baseRevision: "main", git, exceptionRepository },
        entries: [CARVE_OUT_ENTRY, REASON_ONLY_LOCATION_ENTRY],
      }),
    ).toEqual({ measured: "no", base: { state: "not-given" } });
    expect({ readAt: vi.mocked(exceptionRepository.readAt).mock.calls, textInBase: vi.mocked(git.textInBase).mock.calls }).toEqual({
      readAt: [],
      textInBase: [],
    });
  });

  it("reads the records at the base and only the imported entries' sources, keeping the sources present there", () => {
    const git = gitAnswering({
      changedSince: { outcome: "ok", value: [] },
      textInBase: { outcome: "ok", value: { presence: "present-in-base", text: "[]" } },
    });
    const exceptionRepository = exceptionRepositoryAnswering({ outcome: "ok", value: [CARVE_OUT_ENTRY] });
    expect(
      exceptionBaselineOf({
        check: { repoRoot: REPO_ROOT, baseRevision: "main", git, exceptionRepository },
        entries: [IMPORTED_LOCATION_ENTRY, CARVE_OUT_ENTRY],
      }),
    ).toEqual({ measured: "yes", entriesAtBase: [CARVE_OUT_ENTRY], sourceTextsAtBase: new Map([[LEGACY_SOURCE_FILE, "[]"]]) });
    expect({ readAt: vi.mocked(exceptionRepository.readAt).mock.calls, textInBase: vi.mocked(git.textInBase).mock.calls }).toEqual({
      readAt: [[{ revision: "main" }]],
      textInBase: [[{ repoRoot: REPO_ROOT, baseRevision: "main", file: LEGACY_SOURCE_FILE }]],
    });
  });

  it("leaves out an imported entry's source the base does not hold", () => {
    const git = gitAnswering({ changedSince: { outcome: "ok", value: [] }, textInBase: { outcome: "ok", value: { presence: "absent-from-base" } } });
    expect(
      exceptionBaselineOf({
        check: { repoRoot: REPO_ROOT, baseRevision: "main", git, exceptionRepository: exceptionRepositoryAnswering({ outcome: "ok", value: [] }) },
        entries: [IMPORTED_LOCATION_ENTRY],
      }),
    ).toEqual({ measured: "yes", entriesAtBase: [], sourceTextsAtBase: new Map() });
  });

  it("measures a legacy chain against the records at the base, reading no source", () => {
    const git = gitAnswering({ changedSince: { outcome: "ok", value: [] }, textInBase: { outcome: "failed", error: GIT_FAILURE } });
    expect(
      exceptionBaselineOf({
        check: {
          repoRoot: REPO_ROOT,
          baseRevision: "main",
          git,
          exceptionRepository: exceptionRepositoryAnswering({ outcome: "ok", value: [LEGACY_CHAIN_ENTRY] }),
        },
        entries: [LEGACY_CHAIN_ENTRY],
      }),
    ).toEqual({ measured: "yes", entriesAtBase: [LEGACY_CHAIN_ENTRY], sourceTextsAtBase: new Map() });
    expect(git.textInBase).not.toHaveBeenCalled();
  });

  it("is unmeasured with git's message when the records at the base cannot be read", () => {
    const git = gitAnswering({ changedSince: { outcome: "ok", value: [] }, textInBase: { outcome: "ok", value: { presence: "absent-from-base" } } });
    expect(
      exceptionBaselineOf({
        check: {
          repoRoot: REPO_ROOT,
          baseRevision: "main",
          git,
          exceptionRepository: exceptionRepositoryAnswering({ outcome: "failed", error: GIT_FAILURE }),
        },
        entries: [LEGACY_CHAIN_ENTRY],
      }),
    ).toEqual(UNMEASURED_GIT_FAILED);
  });

  it("is unmeasured with git's message when an imported entry's source cannot be read at the base", () => {
    const git = gitAnswering({ changedSince: { outcome: "ok", value: [] }, textInBase: { outcome: "failed", error: GIT_FAILURE } });
    expect(
      exceptionBaselineOf({
        check: { repoRoot: REPO_ROOT, baseRevision: "main", git, exceptionRepository: exceptionRepositoryAnswering({ outcome: "ok", value: [] }) },
        entries: [IMPORTED_LOCATION_ENTRY],
      }),
    ).toEqual(UNMEASURED_GIT_FAILED);
  });
});
