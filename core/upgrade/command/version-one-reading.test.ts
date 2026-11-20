import { describe, expect, it, vi } from "vitest";
import type { SelectionRepository } from "../../consumer-selection/consumer-selection.ts";
import type { FilePresence, FileTextPort } from "../../platform-ports/file-text-port.ts";
import { createPathPort } from "../../platform-ports/path-port.ts";
import type { SelectionReading } from "../../settings/selection.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { clauseAddressSchema } from "../../values/clause-address.ts";
import { mechanismIdSchema } from "../../values/identifiers.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import type { ExceptionRepository, PlacedEntry } from "../version-one-records/exception-records.ts";
import { versionOneReadOf, type VersionOneReadRequest } from "./version-one-reading.ts";

const LOOPS = clauseAddressSchema.parse("CD-15#loops");

const AUDIT = mechanismIdSchema.parse("audit");

const SELECTION_TEXT = '{ "version": 1, "ruleSets": {}, "clauses": { "CD-15#loops": "eslint" } }';

const NO_TEAM_CONFIG = "export default [];\n";

const IMPORTING_TEAM_CONFIG = 'import disciplines from "./disciplines.eslint.mjs";\nexport default [...disciplines];\n';

const READING: SelectionReading = {
  selection: { selected: [{ address: LOOPS, mechanism: AUDIT, exceptions: "allowed" }], uncovered: [], notAdopted: [], notRun: [], editions: [] },
  bindings: [],
  clauseRoots: [],
  excluded: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "optional",
};

const SINGLE_FILE = repoPathSchema.parse("discipline-exceptions.json");

const CARVE_OUT_ENTRY = { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" } as const;

const SINGLE_FILE_ENTRIES: readonly PlacedEntry[] = [
  { place: { layout: "single-file", file: SINGLE_FILE, index: 0 }, entry: CARVE_OUT_ENTRY },
  { place: { layout: "single-file", file: SINGLE_FILE, index: 1 }, entry: { ...CARVE_OUT_ENTRY, file: "src/b.ts" } },
];

const SPLIT_ENTRIES: readonly PlacedEntry[] = [
  { place: { layout: "split", file: repoPathSchema.parse("discipline-exceptions/file-carve-outs/cd-15.json"), index: 0 }, entry: CARVE_OUT_ENTRY },
];

type Held = {
  readonly entries: readonly PlacedEntry[];
  readonly teamConfigText: string;
  readonly projection: FilePresence;
  readonly reading: SelectionReading;
  readonly selectionText: string;
};

const NOTHING_HELD: Held = { entries: [], teamConfigText: NO_TEAM_CONFIG, projection: "absent", reading: READING, selectionText: SELECTION_TEXT };

const requestOver = (held: Held): VersionOneReadRequest => ({
  repoRoot: absolutePathSchema.parse("/repo"),
  fileText: {
    read: vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: held.selectionText })
      .mockReturnValue({ outcome: "ok", value: held.teamConfigText }),
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValue(held.projection),
    write: vi.fn<FileTextPort["write"]>(),
  },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  selectionRepository: { read: vi.fn<SelectionRepository["read"]>().mockReturnValue({ outcome: "ok", value: held.reading }) },
  exceptionRepository: { read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: held.entries }) },
  trackedPaths: [repoPathSchema.parse("eslint.config.mjs")],
});

describe("versionOneReadOf", () => {
  it("reads the settings, the records as heads, and the files that hold them, for a repository with no version 1 projection", () => {
    expect(versionOneReadOf(requestOver({ ...NOTHING_HELD, entries: SINGLE_FILE_ENTRIES }))).toMatchObject({
      outcome: "ok",
      value: {
        reading: {
          heads: [
            { kind: "file-carve-out", entry: CARVE_OUT_ENTRY },
            { kind: "file-carve-out", entry: { ...CARVE_OUT_ENTRY, file: "src/b.ts" } },
          ],
          teamConfig: undefined,
          versionOneProjection: undefined,
        },
        versionOneFiles: { recordsFiles: ["discipline-exceptions.json"], recordsRoot: { kind: "repository" }, settings: "disciplines.json" },
      },
    });
  });

  it("takes the split layout's folder as the records root and every file the entries sit in", () => {
    expect(versionOneReadOf(requestOver({ ...NOTHING_HELD, entries: SPLIT_ENTRIES }))).toMatchObject({
      outcome: "ok",
      value: {
        versionOneFiles: {
          recordsFiles: ["discipline-exceptions/file-carve-outs/cd-15.json"],
          recordsRoot: { kind: "folder", folder: "discipline-exceptions" },
          settings: "disciplines.json",
        },
      },
    });
  });

  it("names the version 1 projection and finds the team config that imports it when the projection file is present", () => {
    expect(versionOneReadOf(requestOver({ ...NOTHING_HELD, projection: "present", teamConfigText: IMPORTING_TEAM_CONFIG }))).toMatchObject({
      outcome: "ok",
      value: { reading: { teamConfig: { file: "eslint.config.mjs", text: IMPORTING_TEAM_CONFIG }, versionOneProjection: "disciplines.eslint.mjs" } },
    });
  });

  it("refuses naming the projection when it is present and no tracked file imports it", () => {
    expect(versionOneReadOf(requestOver({ ...NOTHING_HELD, projection: "present" }))).toEqual({
      outcome: "failed",
      error: { kind: "team-config-refused", refusal: { kind: "no-file-imports-projection", projection: "disciplines.eslint.mjs" } },
    });
  });

  it("refuses when the projections of two mechanisms are both present", () => {
    const selectionText = '{ "version": 1, "ruleSets": {}, "clauses": { "CD-15#loops": "eslint", "CD-14#class-syntax": "other" } }';
    expect(versionOneReadOf(requestOver({ ...NOTHING_HELD, selectionText, projection: "present" }))).toEqual({
      outcome: "failed",
      error: { kind: "several-version-one-projections", projections: ["disciplines.eslint.mjs", "disciplines.other.mjs"] },
    });
  });

  it("refuses records that do not parse, naming them", () => {
    const invalid: PlacedEntry = { place: { layout: "single-file", file: SINGLE_FILE, index: 0 }, entry: { kind: "file-carve-out", clause: "CD-15#unknown", file: "src/a.ts" } };
    expect(versionOneReadOf(requestOver({ ...NOTHING_HELD, entries: [invalid] }))).toMatchObject({
      outcome: "failed",
      error: { kind: "records-refused", refusal: { kind: "invalid-records" } },
    });
  });

  it("fails with the load failure when the settings file cannot be read", () => {
    const request = requestOver(NOTHING_HELD);
    vi.mocked(request.fileText.read).mockReset().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/disciplines.json", detail: "ENOENT" } });
    expect(versionOneReadOf(request)).toMatchObject({ outcome: "failed", error: { kind: "version-one-unreadable", failure: { kind: "file-unreadable" } } });
  });
});
