import { describe, expect, it, vi } from "vitest";
import type { DirectoryEntry, DirectoryPort } from "../../platform-ports/file-system-port.ts";
import type { FileTextPort } from "../../platform-ports/file-text-port.ts";
import { createPathPort } from "../../platform-ports/path-port.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { recordsOnDiskOf, type RecordsOnDiskRequest } from "./version-one-records-on-disk.ts";

const listing = (entries: readonly DirectoryEntry[]): ReturnType<DirectoryPort["list"]> => ({ outcome: "ok", value: entries });

const KIND_FOLDER: DirectoryEntry = { name: "file-carve-outs", kind: "directory" };

const EMPTIED_KIND_FOLDER: DirectoryEntry = { name: "authorised-locations", kind: "directory" };

const README: DirectoryEntry = { name: "README.md", kind: "file" };

const RECORDS_FILE: DirectoryEntry = { name: "cd-15.json", kind: "file" };

const requestOver = (request: { readonly exists: Pick<FileTextPort, "exists">; readonly list: Pick<DirectoryPort, "list"> }): RecordsOnDiskRequest => ({
  repoRoot: absolutePathSchema.parse("/repo"),
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  fileText: request.exists,
  directory: request.list,
});

const presentThenAbsent = (): Pick<FileTextPort, "exists"> => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present").mockReturnValueOnce("absent"),
});

const absentThenPresent = (): Pick<FileTextPort, "exists"> => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent").mockReturnValueOnce("present"),
});

const nothingPresent = (): Pick<FileTextPort, "exists"> => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
});

describe("recordsOnDiskOf", () => {
  it("holds nothing for a repository with no records file and no records folder", () => {
    expect(recordsOnDiskOf(requestOver({ exists: nothingPresent(), list: { list: vi.fn<DirectoryPort["list"]>() } }))).toEqual({
      outcome: "ok",
      value: { files: [], folders: [], root: { kind: "folder", folder: "discipline-exceptions" } },
    });
  });

  it("holds the single file at the repository root even when it lists no entries", () => {
    expect(recordsOnDiskOf(requestOver({ exists: presentThenAbsent(), list: { list: vi.fn<DirectoryPort["list"]>() } }))).toEqual({
      outcome: "ok",
      value: { files: ["discipline-exceptions.json"], folders: [], root: { kind: "repository" } },
    });
  });

  it("holds every json file under the records folder and every folder, an emptied kind folder and the records folder included, ignoring other files", () => {
    const list = vi
      .fn<DirectoryPort["list"]>()
      .mockReturnValueOnce(listing([KIND_FOLDER, EMPTIED_KIND_FOLDER, README]))
      .mockReturnValueOnce(listing([RECORDS_FILE]))
      .mockReturnValueOnce(listing([]));
    expect(recordsOnDiskOf(requestOver({ exists: absentThenPresent(), list: { list } }))).toEqual({
      outcome: "ok",
      value: {
        files: ["discipline-exceptions/file-carve-outs/cd-15.json"],
        folders: ["discipline-exceptions", "discipline-exceptions/file-carve-outs", "discipline-exceptions/authorised-locations"],
        root: { kind: "folder", folder: "discipline-exceptions" },
      },
    });
  });

  it("holds the records folder when every kind folder in it is empty and no file is", () => {
    const list = vi.fn<DirectoryPort["list"]>().mockReturnValueOnce(listing([KIND_FOLDER])).mockReturnValueOnce(listing([]));
    expect(recordsOnDiskOf(requestOver({ exists: absentThenPresent(), list: { list } }))).toEqual({
      outcome: "ok",
      value: {
        files: [],
        folders: ["discipline-exceptions", "discipline-exceptions/file-carve-outs"],
        root: { kind: "folder", folder: "discipline-exceptions" },
      },
    });
  });

  it("fails as an unreadable file when the records folder cannot be listed", () => {
    const list = vi
      .fn<DirectoryPort["list"]>()
      .mockReturnValue({ outcome: "failed", error: { kind: "directory-unreadable", path: absolutePathSchema.parse("/repo/discipline-exceptions"), detail: "EACCES" } });
    expect(recordsOnDiskOf(requestOver({ exists: absentThenPresent(), list: { list } }))).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/repo/discipline-exceptions", detail: "EACCES" },
    });
  });
});
