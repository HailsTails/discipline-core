import { describe, expect, it, vi } from "vitest";
import type { FilePresence, FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { runPathOf } from "./run-path.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const pathOf = (request: { readonly versionOne: FilePresence; readonly versionTwo: FilePresence }) =>
  runPathOf({
    fileText: { exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce(request.versionOne).mockReturnValueOnce(request.versionTwo) },
    path: { join: vi.fn<PathPort["join"]>().mockReturnValueOnce("/repo/disciplines.json").mockReturnValueOnce("/repo/hone.config.json") },
    repoRoot: REPO_ROOT,
  });

describe("runPathOf", () => {
  it("is the version 1 path for a folder that holds disciplines.json", () => {
    expect(pathOf({ versionOne: "present", versionTwo: "absent" })).toEqual({ outcome: "ok", value: "version-1" });
  });

  it("is the version 2 path for a folder that holds hone.config.json", () => {
    expect(pathOf({ versionOne: "absent", versionTwo: "present" })).toEqual({ outcome: "ok", value: "version-2" });
  });

  it("is the version 1 path for a folder that holds neither, so version 1 reports it as it does today", () => {
    expect(pathOf({ versionOne: "absent", versionTwo: "absent" })).toEqual({ outcome: "ok", value: "version-1" });
  });

  it("is settings-in-both-versions for a folder that holds both", () => {
    expect(pathOf({ versionOne: "present", versionTwo: "present" })).toEqual({ outcome: "failed", error: { kind: "settings-in-both-versions", repo: "/repo" } });
  });
});
