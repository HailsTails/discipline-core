import { describe, expect, it, vi } from "vitest";
import type { ErrorWriter, ProcessPort } from "../core/platform-ports/process-port.ts";
import { type ReleaseTextProcess, releaseTextOf, runReleaseText } from "./release-text.ts";

const IDENTITY = {
  name: "Tool",
  packageName: "tooled",
  command: "tool",
  reservedEslintNamespace: "tooled",
  description: "Checks.",
  repository: "https://github.com/example/tool",
  unrelatedNpmPackage: "tool",
};

const processWith = (request: { readonly arguments: readonly string[] }): ReleaseTextProcess => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ErrorWriter>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const outputOf = (request: { readonly process: ReleaseTextProcess }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  errors: vi.mocked(request.process.writeError).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

describe("releaseTextOf", () => {
  it("titles the release with the tool's name and the tag", () => {
    expect(releaseTextOf({ identity: IDENTITY, tag: "v0.1.0-pre.1", part: "title" })).toBe("Tool v0.1.0-pre.1");
  });

  it("notes which npm package the tarball installs as and the command it provides", () => {
    expect(releaseTextOf({ identity: IDENTITY, tag: "v0.1.0-pre.1", part: "notes" })).toBe(
      "Tool v0.1.0-pre.1. Install the attached tarball as the npm package tooled, not tool, which is an unrelated npm package; it provides the command tool.",
    );
  });
});

describe("runReleaseText", () => {
  it("prints the requested part for the tag on standard output and exits 0", () => {
    const processPort = processWith({ arguments: ["title", "v0.1.0-pre.1"] });

    runReleaseText({ process: processPort, identity: IDENTITY });

    expect(outputOf({ process: processPort })).toEqual({ writes: [[{ text: "Tool v0.1.0-pre.1" }]], errors: [], exits: [[{ code: 0 }]] });
  });

  it("exits 2 with its usage on standard error when the part is unknown", () => {
    const processPort = processWith({ arguments: ["body", "v0.1.0-pre.1"] });

    runReleaseText({ process: processPort, identity: IDENTITY });

    expect(outputOf({ process: processPort })).toEqual({
      writes: [],
      errors: [[{ text: "usage: release-text <title|notes> <tag>\n" }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with its usage on standard error when the tag is missing", () => {
    const processPort = processWith({ arguments: ["notes"] });

    runReleaseText({ process: processPort, identity: IDENTITY });

    expect(outputOf({ process: processPort })).toEqual({
      writes: [],
      errors: [[{ text: "usage: release-text <title|notes> <tag>\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});
