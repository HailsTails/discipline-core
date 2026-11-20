import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import type { ListedEntry, ScratchFilesPort } from "./install-proof-ports.ts";
import { shippedPagesAt } from "./shipped-pages.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/pkg" });

const UNREAD: ReturnType<FileTextPort["read"]> = { outcome: "failed", error: { kind: "unreadable", path: "", detail: "missing" } };

const scratchListing = (request: { readonly listTree: ScratchFilesPort["listTree"] }): ScratchFilesPort => ({
  createTemporaryDirectory: vi.fn<ScratchFilesPort["createTemporaryDirectory"]>(),
  removeTree: vi.fn<ScratchFilesPort["removeTree"]>(),
  makeDirectory: vi.fn<ScratchFilesPort["makeDirectory"]>(),
  copyTree: vi.fn<ScratchFilesPort["copyTree"]>(),
  listTree: request.listTree,
  digestOf: vi.fn<ScratchFilesPort["digestOf"]>(),
  realPathOf: vi.fn<ScratchFilesPort["realPathOf"]>(),
});

const fileTextReading = (request: { readonly read: FileTextPort["read"]; readonly exists: FileTextPort["exists"] }): FileTextPort => ({
  read: request.read,
  exists: request.exists,
  write: vi.fn<FileTextPort["write"]>(),
});

const RULES_LISTING: readonly ListedEntry[] = [
  { path: "README.md", name: "README.md", entryKind: "file" },
  { path: "CD-14", name: "CD-14", entryKind: "folder" },
  { path: "CD-14/discipline.json", name: "discipline.json", entryKind: "file" },
  { path: "typescript/tests/fixture.md", name: "fixture.md", entryKind: "file" },
];

const DOCS_LISTING: readonly ListedEntry[] = [{ path: "extending.md", name: "extending.md", entryKind: "file" }];

const listedFolders = () =>
  vi
    .fn<ScratchFilesPort["listTree"]>()
    .mockReturnValueOnce({ outcome: "ok", value: [] })
    .mockReturnValueOnce({ outcome: "ok", value: [] })
    .mockReturnValueOnce({ outcome: "ok", value: RULES_LISTING })
    .mockReturnValueOnce({ outcome: "ok", value: [] })
    .mockReturnValueOnce({ outcome: "ok", value: DOCS_LISTING });

const presentReadme = () => vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present").mockReturnValue("absent");

const readPages = () =>
  vi
    .fn<FileTextPort["read"]>()
    .mockReturnValueOnce({ outcome: "ok", value: "# Hone\n" })
    .mockReturnValueOnce({ outcome: "ok", value: "# Rules\n" })
    .mockReturnValueOnce({ outcome: "ok", value: "# Extending\n" });

describe("shippedPagesAt", () => {
  it("reads each page the package ships: the root pages present, then the pages under each shipped folder, leaving out test folders and other files", () => {
    expect(
      shippedPagesAt({
        scratch: scratchListing({ listTree: listedFolders() }),
        fileText: fileTextReading({ read: readPages(), exists: presentReadme() }),
        path: PATH,
        packageRoot: "/pkg",
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { path: "README.md", text: "# Hone\n" },
        { path: "rules/README.md", text: "# Rules\n" },
        { path: "docs/extending.md", text: "# Extending\n" },
      ],
    });
  });

  it("lists each shipped folder under the package root", () => {
    const listTree = listedFolders();
    shippedPagesAt({ scratch: scratchListing({ listTree }), fileText: fileTextReading({ read: readPages(), exists: presentReadme() }), path: PATH, packageRoot: "/pkg" });
    expect(listTree.mock.calls).toEqual([[{ path: "/pkg/core" }], [{ path: "/pkg/mechanisms" }], [{ path: "/pkg/rules" }], [{ path: "/pkg/methods" }], [{ path: "/pkg/docs" }]]);
  });

  it("fails naming a shipped folder it cannot list", () => {
    expect(
      shippedPagesAt({
        scratch: scratchListing({ listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "failed", error: { kind: "effect-failed", detail: "denied" } }) }),
        fileText: fileTextReading({ read: readPages(), exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent") }),
        path: PATH,
        packageRoot: "/pkg",
      }),
    ).toEqual({ outcome: "failed", error: "list core: denied" });
  });

  it("fails naming a page it cannot read", () => {
    expect(
      shippedPagesAt({
        scratch: scratchListing({ listTree: listedFolders() }),
        fileText: fileTextReading({ read: vi.fn<FileTextPort["read"]>().mockReturnValue(UNREAD), exists: presentReadme() }),
        path: PATH,
        packageRoot: "/pkg",
      }),
    ).toEqual({ outcome: "failed", error: "read README.md: missing" });
  });
});
