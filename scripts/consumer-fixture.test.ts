import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import { requiredEntry } from "../tests/required-entry.ts";
import { materialisedConsumer, materialisedPathOf } from "./consumer-fixture.ts";
import type { ListedEntry, ScratchFilesPort } from "./install-proof-ports.ts";

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const FIXTURE_TEXTS: Readonly<Record<string, string>> = {
  "/fixture/disciplines.json.fixture": "{}\n",
  "/fixture/src/kept.ts.fixture": "export const kept = 1;\n",
};

const SUFFIXED: readonly ListedEntry[] = [
  { path: "disciplines.json.fixture", name: "disciplines.json.fixture", entryKind: "file" },
  { path: "src", name: "src", entryKind: "folder" },
  { path: "src/kept.ts.fixture", name: "kept.ts.fixture", entryKind: "file" },
];

const WITH_UNSUFFIXED: readonly ListedEntry[] = [...SUFFIXED, { path: "src/plain.ts", name: "plain.ts", entryKind: "file" }];

const fileTextPort = (): FileTextPort => ({
  read: ({ path: read }) => ({ outcome: "ok", value: requiredEntry({ table: FIXTURE_TEXTS, key: read }) }),
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const scratchListing = (entries: readonly ListedEntry[]): ScratchFilesPort => ({
  createTemporaryDirectory: vi.fn<ScratchFilesPort["createTemporaryDirectory"]>(),
  removeTree: vi.fn<ScratchFilesPort["removeTree"]>(),
  removeFile: vi.fn<ScratchFilesPort["removeFile"]>(),
  makeDirectory: vi.fn<ScratchFilesPort["makeDirectory"]>().mockReturnValue({ outcome: "ok", value: null }),
  copyTree: vi.fn<ScratchFilesPort["copyTree"]>(),
  listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "ok", value: entries }),
  digestOf: vi.fn<ScratchFilesPort["digestOf"]>(),
  realPathOf: vi.fn<ScratchFilesPort["realPathOf"]>(),
});

describe("materialisedPathOf", () => {
  it("strips the fixture suffix from a consumer fixture's file", () => {
    expect(materialisedPathOf({ path: "src/kept.ts.fixture" })).toEqual({ outcome: "ok", value: "src/kept.ts" });
  });

  it("refuses a file without the fixture suffix, saying why the suffix is needed", () => {
    expect(materialisedPathOf({ path: "src/kept.ts" })).toEqual({
      outcome: "failed",
      error: "src/kept.ts does not end in .fixture: a consumer fixture holds another repository's files, which this repository must not check as its own",
    });
  });
});

describe("materialisedConsumer", () => {
  it("writes each fixture file under the consumer without its suffix, making its folder first", () => {
    const fileText = fileTextPort();
    const scratch = scratchListing(SUFFIXED);

    const materialised = materialisedConsumer({ scratch, fileText, path, from: "/fixture", to: "/consumer" });

    expect({ materialised, folders: vi.mocked(scratch.makeDirectory).mock.calls, writes: vi.mocked(fileText.write).mock.calls }).toEqual({
      materialised: { outcome: "ok", value: null },
      folders: [[{ path: "/consumer" }], [{ path: "/consumer/src" }]],
      writes: [
        [{ path: "/consumer/disciplines.json", text: "{}\n" }],
        [{ path: "/consumer/src/kept.ts", text: "export const kept = 1;\n" }],
      ],
    });
  });

  it("refuses a fixture holding a file without the suffix before writing any file", () => {
    const fileText = fileTextPort();

    const materialised = materialisedConsumer({ scratch: scratchListing(WITH_UNSUFFIXED), fileText, path, from: "/fixture", to: "/consumer" });

    expect({ materialised, writes: vi.mocked(fileText.write).mock.calls }).toEqual({
      materialised: {
        outcome: "failed",
        error: "src/plain.ts does not end in .fixture: a consumer fixture holds another repository's files, which this repository must not check as its own",
      },
      writes: [],
    });
  });

  it("fails with the listing's detail when the fixture cannot be listed", () => {
    const scratch: ScratchFilesPort = {
      ...scratchListing([]),
      listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "failed", error: { kind: "effect-failed", detail: "ENOENT" } }),
    };

    expect(materialisedConsumer({ scratch, fileText: fileTextPort(), path, from: "/fixture", to: "/consumer" })).toEqual({
      outcome: "failed",
      error: "ENOENT",
    });
  });
});
