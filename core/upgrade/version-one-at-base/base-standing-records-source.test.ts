import { describe, expect, it, vi } from "vitest";
import type { RecordsDocument } from "../../records/hone-record.ts";
import type { RecordsSource } from "../../records/records-source.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import type { ExceptionRepository } from "../version-one-records/exception-records.ts";
import { baseStandingRecordsSource, versionOneAwareRecordsSourceOf } from "./base-standing-records-source.ts";
import type { VersionOneEntries } from "./version-one-entries.ts";

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/loop-keyword.json");

const OTHER_FILE = repoPathSchema.parse("hone-records/debt/rebinding.json");

const BASE_ENTRY = { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" } as const;

const EDITED_ENTRY = { ...BASE_ENTRY, reason: "legacy loop, kept" } as const;

const headDocumentCarrying = (request: { readonly carried: object }): RecordsDocument => ({
  file: DEBT_FILE,
  document: { version: 2, records: [{ symptom: "loop-keyword#loops", file: "src/a.ts", carried: request.carried }] },
});

const sourceReading = (request: {
  readonly head: ReturnType<RecordsSource["read"]>;
  readonly base: ReturnType<RecordsSource["readAt"]>;
}): RecordsSource => ({
  read: vi.fn<RecordsSource["read"]>().mockReturnValue(request.head),
  readAt: vi.fn<RecordsSource["readAt"]>().mockReturnValue(request.base),
});

const entriesAtBase = (request: { readonly read: ReturnType<VersionOneEntries["atBase"]> }): VersionOneEntries => ({
  atBase: vi.fn<VersionOneEntries["atBase"]>().mockReturnValue(request.read),
});

const NO_DOCUMENTS = { outcome: "ok", value: [] } as const;

describe("baseStandingRecordsSource", () => {
  it("gives the base a document of the carried record with the version 1 entry the base held in place of the carried one", () => {
    expect(
      baseStandingRecordsSource({
        source: sourceReading({ head: { outcome: "ok", value: [headDocumentCarrying({ carried: BASE_ENTRY })] }, base: NO_DOCUMENTS }),
        entries: entriesAtBase({ read: { outcome: "ok", value: [BASE_ENTRY] } }),
      }).readAt({ revision: "origin/main" }),
    ).toEqual({
      outcome: "ok",
      value: [{ file: DEBT_FILE, document: { version: 2, records: [{ symptom: "loop-keyword#loops", file: "src/a.ts", carried: BASE_ENTRY }] } }],
    });
  });

  it("gives the base the entry as the base held it, so a carried entry edited since then differs from it", () => {
    expect(
      baseStandingRecordsSource({
        source: sourceReading({ head: { outcome: "ok", value: [headDocumentCarrying({ carried: EDITED_ENTRY })] }, base: NO_DOCUMENTS }),
        entries: entriesAtBase({ read: { outcome: "ok", value: [BASE_ENTRY] } }),
      }).readAt({ revision: "origin/main" }),
    ).toEqual({
      outcome: "ok",
      value: [{ file: DEBT_FILE, document: { version: 2, records: [{ symptom: "loop-keyword#loops", file: "src/a.ts", carried: BASE_ENTRY }] } }],
    });
  });

  it("gives every base entry of the carried record's clause and file, one record each", () => {
    const authorised = { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" } as const;
    expect(
      baseStandingRecordsSource({
        source: sourceReading({ head: { outcome: "ok", value: [headDocumentCarrying({ carried: BASE_ENTRY })] }, base: NO_DOCUMENTS }),
        entries: entriesAtBase({ read: { outcome: "ok", value: [BASE_ENTRY, authorised] } }),
      }).readAt({ revision: "origin/main" }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          file: DEBT_FILE,
          document: {
            version: 2,
            records: [
              { symptom: "loop-keyword#loops", file: "src/a.ts", carried: BASE_ENTRY },
              { symptom: "loop-keyword#loops", file: "src/a.ts", carried: authorised },
            ],
          },
        },
      ],
    });
  });

  it("leaves a file the base already holds as a version 2 document as the base holds it", () => {
    const held: RecordsDocument = { file: DEBT_FILE, document: { version: 2, records: [] } };
    expect(
      baseStandingRecordsSource({
        source: sourceReading({ head: { outcome: "ok", value: [headDocumentCarrying({ carried: BASE_ENTRY })] }, base: { outcome: "ok", value: [held] } }),
        entries: entriesAtBase({ read: { outcome: "ok", value: [BASE_ENTRY] } }),
      }).readAt({ revision: "origin/main" }),
    ).toEqual({ outcome: "ok", value: [held] });
  });

  it("keeps the documents of other files the base holds beside the synthesised one", () => {
    const held: RecordsDocument = { file: OTHER_FILE, document: { version: 2, records: [] } };
    expect(
      baseStandingRecordsSource({
        source: sourceReading({ head: { outcome: "ok", value: [headDocumentCarrying({ carried: BASE_ENTRY })] }, base: { outcome: "ok", value: [held] } }),
        entries: entriesAtBase({ read: { outcome: "ok", value: [BASE_ENTRY] } }),
      }).readAt({ revision: "origin/main" }),
    ).toEqual({
      outcome: "ok",
      value: [held, { file: DEBT_FILE, document: { version: 2, records: [{ symptom: "loop-keyword#loops", file: "src/a.ts", carried: BASE_ENTRY }] } }],
    });
  });

  it("gives nothing for a stated record, which carries no version 1 entry", () => {
    expect(
      baseStandingRecordsSource({
        source: sourceReading({
          head: { outcome: "ok", value: [{ file: DEBT_FILE, document: { version: 2, records: [{ symptom: "loop-keyword#loops", file: "src/a.ts", note: "legacy" }] } }] },
          base: NO_DOCUMENTS,
        }),
        entries: entriesAtBase({ read: { outcome: "ok", value: [BASE_ENTRY] } }),
      }).readAt({ revision: "origin/main" }),
    ).toEqual(NO_DOCUMENTS);
  });

  it("gives nothing for a carried record whose clause and file no base entry has", () => {
    expect(
      baseStandingRecordsSource({
        source: sourceReading({ head: { outcome: "ok", value: [headDocumentCarrying({ carried: { ...BASE_ENTRY, file: "src/elsewhere.ts" } })] }, base: NO_DOCUMENTS }),
        entries: entriesAtBase({ read: { outcome: "ok", value: [BASE_ENTRY] } }),
      }).readAt({ revision: "origin/main" }),
    ).toEqual(NO_DOCUMENTS);
  });

  it("gives nothing for a head file that is not a records document", () => {
    expect(
      baseStandingRecordsSource({
        source: sourceReading({ head: { outcome: "ok", value: [{ file: DEBT_FILE, document: { records: [] } }] }, base: NO_DOCUMENTS }),
        entries: entriesAtBase({ read: { outcome: "ok", value: [BASE_ENTRY] } }),
      }).readAt({ revision: "origin/main" }),
    ).toEqual(NO_DOCUMENTS);
  });

  it("returns what the source read at the base when the head cannot be read", () => {
    expect(
      baseStandingRecordsSource({
        source: sourceReading({ head: { outcome: "failed", error: { kind: "records-folder-unreadable", folder: repoPathSchema.parse("hone-records"), detail: "denied" } }, base: NO_DOCUMENTS }),
        entries: entriesAtBase({ read: { outcome: "ok", value: [BASE_ENTRY] } }),
      }).readAt({ revision: "origin/main" }),
    ).toEqual(NO_DOCUMENTS);
  });

  it("fails as the source did when it cannot read the base", () => {
    expect(
      baseStandingRecordsSource({
        source: sourceReading({ head: { outcome: "ok", value: [] }, base: { outcome: "failed", error: { kind: "git-failed", command: "git ls-tree", detail: "unknown revision" } } }),
        entries: entriesAtBase({ read: { outcome: "ok", value: [] } }),
      }).readAt({ revision: "origin/main" }),
    ).toEqual({ outcome: "failed", error: { kind: "git-failed", command: "git ls-tree", detail: "unknown revision" } });
  });

  it("fails with the git failure that stopped the version 1 entries being read at the base", () => {
    expect(
      baseStandingRecordsSource({
        source: sourceReading({ head: { outcome: "ok", value: [headDocumentCarrying({ carried: BASE_ENTRY })] }, base: NO_DOCUMENTS }),
        entries: entriesAtBase({ read: { outcome: "failed", error: { kind: "git-failed", command: "git show", detail: "bad object" } } }),
      }).readAt({ revision: "origin/main" }),
    ).toEqual({ outcome: "failed", error: { kind: "git-failed", command: "git show", detail: "bad object" } });
  });

  it("reads the head as the source does", () => {
    const head = { outcome: "ok", value: [headDocumentCarrying({ carried: BASE_ENTRY })] } as const;
    expect(
      baseStandingRecordsSource({ source: sourceReading({ head, base: NO_DOCUMENTS }), entries: entriesAtBase({ read: { outcome: "ok", value: [] } }) }).read(),
    ).toEqual(head);
  });
});

describe("versionOneAwareRecordsSourceOf", () => {
  it("builds the source for a repository from the factory it wraps and the version 1 repository of the same root", () => {
    const repoRoot = absolutePathSchema.parse("/repo");
    const repository: Pick<ExceptionRepository, "readAt"> = {
      readAt: vi.fn<ExceptionRepository["readAt"]>().mockReturnValue({ outcome: "ok", value: [BASE_ENTRY] }),
    };
    const exceptionRepositoryOf = vi.fn<(request: { readonly repoRoot: typeof repoRoot }) => Pick<ExceptionRepository, "readAt">>().mockReturnValue(repository);
    const source = versionOneAwareRecordsSourceOf({
      recordsSourceOf: () => sourceReading({ head: { outcome: "ok", value: [headDocumentCarrying({ carried: BASE_ENTRY })] }, base: NO_DOCUMENTS }),
      exceptionRepositoryOf,
    })({
      fileText: { exists: vi.fn(), read: vi.fn() },
      path: { join: vi.fn() },
      directory: { list: vi.fn() },
      git: { textInBase: vi.fn() },
      gitTree: { pathsAt: vi.fn() },
      repoRoot,
    });
    expect(source.readAt({ revision: "origin/main" })).toEqual({
      outcome: "ok",
      value: [{ file: DEBT_FILE, document: { version: 2, records: [{ symptom: "loop-keyword#loops", file: "src/a.ts", carried: BASE_ENTRY }] } }],
    });
    expect(exceptionRepositoryOf).toHaveBeenCalledWith({ repoRoot });
  });
});
