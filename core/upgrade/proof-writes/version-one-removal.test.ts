import { describe, expect, it, vi } from "vitest";
import type { DirectoryRemovalPort } from "../../platform-ports/directory-removal-port.ts";
import type { FileRemovalPort } from "../../platform-ports/file-removal-port.ts";
import type { DirectoryPort } from "../../platform-ports/file-system-port.ts";
import { createPathPort } from "../../platform-ports/path-port.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { removedVersionOneFiles, type VersionOneRemoval, type VersionOneRemovalPorts } from "./version-one-removal.ts";

const ROOT = absolutePathSchema.parse("/repo/discipline-exceptions");

const AUTHORISED_FOLDER = absolutePathSchema.parse("/repo/discipline-exceptions/authorised-locations");

const CARVE_OUT_FILE = absolutePathSchema.parse("/repo/discipline-exceptions/file-carve-outs/cd-15.json");

const CARVE_OUT_FOLDER = absolutePathSchema.parse("/repo/discipline-exceptions/file-carve-outs");

const AUTHORISED_FILE = absolutePathSchema.parse("/repo/discipline-exceptions/authorised-locations/cd-15.json");

const PROJECTION = absolutePathSchema.parse("/repo/disciplines.eslint.mjs");

const SETTINGS = absolutePathSchema.parse("/repo/disciplines.json");

const REMOVAL: VersionOneRemoval = { recordsFiles: [CARVE_OUT_FILE, AUTHORISED_FILE], recordsRoot: ROOT, projection: PROJECTION, settings: SETTINGS };

const ok = { outcome: "ok", value: undefined } as const;

const portsOver = () => ({
  fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>().mockReturnValue(ok) },
  directory: { list: vi.fn<DirectoryPort["list"]>().mockReturnValue({ outcome: "ok", value: [] }), create: vi.fn<DirectoryPort["create"]>() },
  directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>().mockReturnValue(ok) },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
}) satisfies VersionOneRemovalPorts;

describe("removedVersionOneFiles", () => {
  it("removes the records files, then the projection, and the settings file last", () => {
    const ports = portsOver();
    expect(removedVersionOneFiles({ ports, removal: REMOVAL })).toEqual({
      outcome: "ok",
      value: {
        files: [CARVE_OUT_FILE, AUTHORISED_FILE, PROJECTION, SETTINGS],
        folders: [AUTHORISED_FOLDER, CARVE_OUT_FOLDER, ROOT],
      },
    });
    expect(ports.fileRemoval.remove.mock.calls).toEqual([[{ path: CARVE_OUT_FILE }], [{ path: AUTHORISED_FILE }], [{ path: PROJECTION }], [{ path: SETTINGS }]]);
  });

  it("removes the emptied folders deepest first, then the records folder itself", () => {
    const ports = portsOver();
    removedVersionOneFiles({ ports, removal: REMOVAL });
    expect(ports.directoryRemoval.removeEmpty.mock.calls).toEqual([[{ path: AUTHORISED_FOLDER }], [{ path: CARVE_OUT_FOLDER }], [{ path: ROOT }]]);
  });

  it("removes the folders after the records files and before the settings file", () => {
    const ports = portsOver();
    removedVersionOneFiles({ ports, removal: REMOVAL });
    const [lastRecords, , , settings] = ports.fileRemoval.remove.mock.invocationCallOrder;
    const [firstFolder] = ports.directoryRemoval.removeEmpty.mock.invocationCallOrder;
    expect(lastRecords).toBeLessThan(firstFolder);
    expect(firstFolder).toBeLessThan(settings);
  });

  it("leaves a folder that still holds something", () => {
    const ports = portsOver();
    ports.directory.list.mockReturnValueOnce({ outcome: "ok", value: [] }).mockReturnValueOnce({ outcome: "ok", value: [{ name: "notes.md", kind: "file" }] });
    expect(removedVersionOneFiles({ ports, removal: REMOVAL })).toEqual({
      outcome: "ok",
      value: { files: [CARVE_OUT_FILE, AUTHORISED_FILE, PROJECTION, SETTINGS], folders: [AUTHORISED_FOLDER, ROOT] },
    });
  });

  it("removes no projection when none is given", () => {
    const ports = portsOver();
    expect(removedVersionOneFiles({ ports, removal: { ...REMOVAL, projection: undefined } })).toEqual({
      outcome: "ok",
      value: { files: [CARVE_OUT_FILE, AUTHORISED_FILE, SETTINGS], folders: [AUTHORISED_FOLDER, CARVE_OUT_FOLDER, ROOT] },
    });
  });

  it("stops at the first file it cannot remove and says what it had removed, so the settings file stays", () => {
    const ports = portsOver();
    ports.fileRemoval.remove.mockReturnValueOnce(ok).mockReturnValueOnce({ outcome: "failed", error: { kind: "unremovable", path: AUTHORISED_FILE, detail: "EBUSY" } });
    expect(removedVersionOneFiles({ ports, removal: REMOVAL })).toEqual({
      outcome: "failed",
      error: { kind: "unremovable", path: AUTHORISED_FILE, detail: "EBUSY", removed: { files: [CARVE_OUT_FILE], folders: [] } },
    });
    expect(ports.fileRemoval.remove).toHaveBeenCalledTimes(2);
  });

  it("stops when a folder cannot be listed", () => {
    const ports = portsOver();
    ports.directory.list.mockReturnValueOnce({ outcome: "failed", error: { kind: "directory-unreadable", path: AUTHORISED_FOLDER, detail: "EACCES" } });
    expect(removedVersionOneFiles({ ports, removal: REMOVAL })).toEqual({
      outcome: "failed",
      error: { kind: "unremovable", path: AUTHORISED_FOLDER, detail: "EACCES", removed: { files: [CARVE_OUT_FILE, AUTHORISED_FILE], folders: [] } },
    });
  });

  it("stops when a listed empty folder cannot be removed", () => {
    const ports = portsOver();
    ports.directoryRemoval.removeEmpty.mockReturnValueOnce({ outcome: "failed", error: { kind: "directory-unremovable", path: AUTHORISED_FOLDER, detail: "EBUSY" } });
    expect(removedVersionOneFiles({ ports, removal: REMOVAL })).toEqual({
      outcome: "failed",
      error: { kind: "unremovable", path: AUTHORISED_FOLDER, detail: "EBUSY", removed: { files: [CARVE_OUT_FILE, AUTHORISED_FILE], folders: [] } },
    });
  });
});
