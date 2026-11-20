import { describe, expect, it, vi } from "vitest";
import type { DirectoryRemovalPort } from "../../platform-ports/directory-removal-port.ts";
import type { FileRemovalPort } from "../../platform-ports/file-removal-port.ts";
import type { DirectoryPort, EntryKindPort, FileTextPort } from "../../platform-ports/file-system-port.ts";
import { createPathPort } from "../../platform-ports/path-port.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { type PlannedFile, type ProofWritePorts, type ProofWrites, rolledBackProofWrites, writeProofFiles } from "./proof-writes.ts";

const RECORDS_FOLDER = absolutePathSchema.parse("/repo/hone-records");

const DEBT_FOLDER = absolutePathSchema.parse("/repo/hone-records/debt");

const DEBT_FILE: PlannedFile = { path: absolutePathSchema.parse("/repo/hone-records/debt/loop-keyword.json"), text: "debt text" };

const CONFIG = absolutePathSchema.parse("/repo/eslint.config.mjs");

const REWRITTEN_CONFIG: PlannedFile = { path: CONFIG, text: "rewritten config" };

const ORIGINAL_CONFIG = "original config";

const WRITTEN: ProofWrites = [
  { kind: "directory-created", path: RECORDS_FOLDER },
  { kind: "directory-created", path: DEBT_FOLDER },
  { kind: "file-created", path: DEBT_FILE.path },
  { kind: "file-replaced", path: CONFIG, original: ORIGINAL_CONFIG },
];

const ok = { outcome: "ok", value: undefined } as const;

const kindsOfNewFileUnderNewFolders = () =>
  vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("absent").mockReturnValueOnce("absent").mockReturnValueOnce("absent").mockReturnValueOnce("directory");

const kindsOfNewFileUnderExistingFolder = () => vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("absent").mockReturnValueOnce("directory");

const kindsOfExistingFile = () => vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("file");

const kindsOfNewFileOnly = () => vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("absent");

const noKindsAsked = () => vi.fn<EntryKindPort["kindOf"]>();

const portsOver = (request: { readonly kindOf: EntryKindPort["kindOf"] }) => {
  const ports = {
    fileText: {
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: ORIGINAL_CONFIG }),
      exists: vi.fn<FileTextPort["exists"]>(),
      write: vi.fn<FileTextPort["write"]>().mockReturnValue(ok),
    },
    fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>().mockReturnValue(ok) },
    directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>().mockReturnValue(ok) },
    directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>().mockReturnValue(ok) },
    entryKind: { kindOf: request.kindOf },
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  } satisfies ProofWritePorts;
  return ports;
};

describe("writeProofFiles", () => {
  it("creates the missing folders shallowest first, writes the new files, then replaces the config, and records each", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderNewFolders() });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacement: REWRITTEN_CONFIG })).toEqual({ outcome: "ok", value: WRITTEN });
    expect(ports.directory.create.mock.calls).toEqual([[{ path: RECORDS_FOLDER }], [{ path: DEBT_FOLDER }]]);
    expect(ports.fileText.write.mock.calls).toEqual([
      [{ path: DEBT_FILE.path, text: "debt text" }],
      [{ path: CONFIG, text: "rewritten config" }],
    ]);
    expect(ports.fileText.read).toHaveBeenCalledExactlyOnceWith({ path: CONFIG });
  });

  it("creates no folder that already exists", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderExistingFolder() });
    expect(writeProofFiles({ ports, files: [{ path: absolutePathSchema.parse("/repo/hone.eslint.mjs"), text: "projection" }], replacement: undefined })).toEqual({
      outcome: "ok",
      value: [{ kind: "file-created", path: "/repo/hone.eslint.mjs" }],
    });
    expect(ports.directory.create).not.toHaveBeenCalled();
  });

  it("refuses before any write when a planned file already exists", () => {
    const ports = portsOver({ kindOf: kindsOfExistingFile() });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacement: REWRITTEN_CONFIG })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "path-already-exists", path: DEBT_FILE.path }, unrestored: [] },
    });
    expect(ports.directory.create).not.toHaveBeenCalled();
    expect(ports.fileText.write).not.toHaveBeenCalled();
  });

  it("refuses before any write when the file it would replace cannot be read", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileOnly() });
    ports.fileText.read.mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: CONFIG, detail: "ENOENT" } });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacement: REWRITTEN_CONFIG })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "replaced-file-unreadable", path: CONFIG, detail: "ENOENT" }, unrestored: [] },
    });
    expect(ports.fileText.write).not.toHaveBeenCalled();
  });

  it("leaves nothing behind when the first folder cannot be created", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderNewFolders() });
    ports.directory.create.mockReturnValueOnce({ outcome: "failed", error: { kind: "directory-uncreatable", path: RECORDS_FOLDER, detail: "EACCES" } });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacement: REWRITTEN_CONFIG })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "directory-uncreatable", path: RECORDS_FOLDER, detail: "EACCES" }, unrestored: [] },
    });
    expect(ports.directoryRemoval.removeEmpty).not.toHaveBeenCalled();
  });

  it("removes the folders it created, deepest first, when a new file cannot be written", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderNewFolders() });
    ports.fileText.write.mockReturnValueOnce({ outcome: "failed", error: { kind: "unwritable", path: DEBT_FILE.path, detail: "ENOSPC" } });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacement: REWRITTEN_CONFIG })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "unwritable", path: DEBT_FILE.path, detail: "ENOSPC" }, unrestored: [] },
    });
    expect(ports.directoryRemoval.removeEmpty.mock.calls).toEqual([[{ path: DEBT_FOLDER }], [{ path: RECORDS_FOLDER }]]);
  });

  it("restores the config's original bytes and removes what it created when the config cannot be rewritten", () => {
    const ports = portsOver({ kindOf: kindsOfNewFileUnderNewFolders() });
    ports.fileText.write.mockReturnValueOnce(ok).mockReturnValueOnce({ outcome: "failed", error: { kind: "unwritable", path: CONFIG, detail: "EPERM" } });
    expect(writeProofFiles({ ports, files: [DEBT_FILE], replacement: REWRITTEN_CONFIG })).toEqual({
      outcome: "failed",
      error: { failure: { kind: "unwritable", path: CONFIG, detail: "EPERM" }, unrestored: [] },
    });
    expect(ports.fileText.write.mock.calls).toEqual([
      [{ path: DEBT_FILE.path, text: "debt text" }],
      [{ path: CONFIG, text: "rewritten config" }],
      [{ path: CONFIG, text: ORIGINAL_CONFIG }],
    ]);
    expect(ports.fileRemoval.remove).toHaveBeenCalledExactlyOnceWith({ path: DEBT_FILE.path });
    expect(ports.directoryRemoval.removeEmpty.mock.calls).toEqual([[{ path: DEBT_FOLDER }], [{ path: RECORDS_FOLDER }]]);
  });
});

describe("rolledBackProofWrites", () => {
  it("undoes the writes in reverse: the config's original bytes, the created file, then the created folders deepest first", () => {
    const ports = portsOver({ kindOf: noKindsAsked() });
    expect(rolledBackProofWrites({ ports, writes: WRITTEN })).toEqual([]);
    expect(ports.fileText.write).toHaveBeenCalledExactlyOnceWith({ path: CONFIG, text: ORIGINAL_CONFIG });
    expect(ports.fileRemoval.remove).toHaveBeenCalledExactlyOnceWith({ path: DEBT_FILE.path });
    expect(ports.directoryRemoval.removeEmpty.mock.calls).toEqual([[{ path: DEBT_FOLDER }], [{ path: RECORDS_FOLDER }]]);
    const [restored] = ports.fileText.write.mock.invocationCallOrder;
    const [fileRemoved] = ports.fileRemoval.remove.mock.invocationCallOrder;
    const [debtRemoved, recordsRemoved] = ports.directoryRemoval.removeEmpty.mock.invocationCallOrder;
    expect([restored, fileRemoved, debtRemoved, recordsRemoved]).toEqual([restored, restored + 1, restored + 2, restored + 3]);
  });

  it("reports each path it could not undo and still undoes the rest", () => {
    const ports = portsOver({ kindOf: noKindsAsked() });
    ports.fileRemoval.remove.mockReturnValue({ outcome: "failed", error: { kind: "unremovable", path: DEBT_FILE.path, detail: "EBUSY" } });
    expect(rolledBackProofWrites({ ports, writes: WRITTEN })).toEqual([{ path: DEBT_FILE.path, detail: "EBUSY" }]);
    expect(ports.directoryRemoval.removeEmpty).toHaveBeenCalledTimes(2);
  });

  it("undoes nothing when nothing was written", () => {
    const ports = portsOver({ kindOf: noKindsAsked() });
    expect(rolledBackProofWrites({ ports, writes: [] })).toEqual([]);
    expect(ports.fileText.write).not.toHaveBeenCalled();
  });
});
