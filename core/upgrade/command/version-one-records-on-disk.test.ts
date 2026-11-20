import { describe, expect, it, vi } from "vitest";
import type { DirectoryEntry, DirectoryPort } from "../../platform-ports/file-system-port.ts";
import type { FileTextPort } from "../../platform-ports/file-text-port.ts";
import { createPathPort } from "../../platform-ports/path-port.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { recordsOnDiskOf, type RecordsOnDiskRequest } from "./version-one-records-on-disk.ts";

type Listed = { readonly folder: string; readonly entry: DirectoryEntry };

const file = (folder: string, name: string): Listed => ({ folder, entry: { name, kind: "file" } });

const directory = (folder: string, name: string): Listed => ({ folder, entry: { name, kind: "directory" } });

const requestOver = (request: { readonly present: readonly string[]; readonly listed: readonly Listed[] }): RecordsOnDiskRequest => ({
  repoRoot: absolutePathSchema.parse("/repo"),
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  fileText: { exists: ({ path }) => (request.present.includes(path) ? "present" : "absent") },
  directory: {
    list: ({ path }) => ({ outcome: "ok", value: request.listed.filter(({ folder }) => folder === path).map(({ entry }) => entry) }),
  },
});

describe("recordsOnDiskOf", () => {
  it("holds nothing for a repository with no records file and no records folder", () => {
    expect(recordsOnDiskOf(requestOver({ present: [], listed: [] }))).toEqual({
      outcome: "ok",
      value: { files: [], folders: [], root: { kind: "folder", folder: "discipline-exceptions" } },
    });
  });

  it("holds the single file at the repository root even when it lists no entries", () => {
    expect(recordsOnDiskOf(requestOver({ present: ["/repo/discipline-exceptions.json"], listed: [] }))).toEqual({
      outcome: "ok",
      value: { files: ["discipline-exceptions.json"], folders: [], root: { kind: "repository" } },
    });
  });

  it("holds every json file under the records folder and every folder, an emptied kind folder and the records folder included, ignoring other files", () => {
    expect(
      recordsOnDiskOf(
        requestOver({
          present: ["/repo/discipline-exceptions"],
          listed: [
            directory("/repo/discipline-exceptions", "file-carve-outs"),
            directory("/repo/discipline-exceptions", "authorised-locations"),
            file("/repo/discipline-exceptions", "README.md"),
            file("/repo/discipline-exceptions/file-carve-outs", "cd-15.json"),
          ],
        }),
      ),
    ).toEqual({
      outcome: "ok",
      value: {
        files: ["discipline-exceptions/file-carve-outs/cd-15.json"],
        folders: ["discipline-exceptions", "discipline-exceptions/file-carve-outs", "discipline-exceptions/authorised-locations"],
        root: { kind: "folder", folder: "discipline-exceptions" },
      },
    });
  });

  it("holds the records folder when every kind folder in it is empty and no file is", () => {
    expect(recordsOnDiskOf(requestOver({ present: ["/repo/discipline-exceptions"], listed: [directory("/repo/discipline-exceptions", "file-carve-outs")] }))).toEqual({
      outcome: "ok",
      value: {
        files: [],
        folders: ["discipline-exceptions", "discipline-exceptions/file-carve-outs"],
        root: { kind: "folder", folder: "discipline-exceptions" },
      },
    });
  });

  it("fails as an unreadable file when the records folder cannot be listed", () => {
    const request = requestOver({ present: ["/repo/discipline-exceptions"], listed: [] });
    const failing: Pick<DirectoryPort, "list"> = {
      list: vi.fn<DirectoryPort["list"]>().mockReturnValue({ outcome: "failed", error: { kind: "directory-unreadable", path: absolutePathSchema.parse("/repo/discipline-exceptions"), detail: "EACCES" } }),
    };
    expect(recordsOnDiskOf({ ...request, directory: failing, fileText: { exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present") } })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/repo/discipline-exceptions", detail: "EACCES" },
    });
  });
});
