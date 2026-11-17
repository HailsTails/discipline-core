import { describe, expect, it, vi } from "vitest";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { releaseStateOf, runReleaseState } from "./release-state.ts";

const manifestAt = (version: string): string => `{\n  "name": "tooled",\n  "version": ${JSON.stringify(version)}\n}`;

const COMMIT = "d32d2530312c64d2938aeab5753737e89f972e48";

const remoteTagsOf = (tags: readonly string[]): string => tags.map((tag) => `${COMMIT}\trefs/tags/${tag}`).join("\n");

const RELEASED_TAGS = remoteTagsOf(["v0.1.0-pre.5", "v0.1.0-pre.6"]);

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const runWith = (request: { readonly arguments: readonly string[] }) => {
  const processPort = processWith(request);
  runReleaseState({ process: processPort });
  return {
    writes: vi.mocked(processPort.writeOut).mock.calls,
    errors: vi.mocked(processPort.writeError).mock.calls,
    exits: vi.mocked(processPort.exitWith).mock.calls,
  };
};

describe("releaseStateOf", () => {
  it("releases a version this push changed to when the remote has no tag for it", () => {
    expect(
      releaseStateOf({ manifest: manifestAt("0.1.0-pre.7"), previousManifest: manifestAt("0.1.0-pre.6"), remoteTags: RELEASED_TAGS }),
    ).toEqual({ outcome: "ok", value: { tag: "v0.1.0-pre.7", state: "unreleased" } });
  });

  it("releases nothing when this push leaves the version as it was, even when that version has no tag", () => {
    expect(
      releaseStateOf({ manifest: manifestAt("0.1.0-pre.7"), previousManifest: manifestAt("0.1.0-pre.7"), remoteTags: RELEASED_TAGS }),
    ).toEqual({ outcome: "ok", value: { tag: "v0.1.0-pre.7", state: "version-unchanged" } });
  });

  it("releases nothing when the version this push changed to already has its tag on the remote", () => {
    expect(
      releaseStateOf({ manifest: manifestAt("0.1.0-pre.6"), previousManifest: manifestAt("0.1.0-pre.7"), remoteTags: RELEASED_TAGS }),
    ).toEqual({ outcome: "ok", value: { tag: "v0.1.0-pre.6", state: "already-released" } });
  });

  it("releases the first version when the remote has no tags at all", () => {
    expect(releaseStateOf({ manifest: manifestAt("1.0.0"), previousManifest: manifestAt("0.1.0-pre.6"), remoteTags: "" })).toEqual({
      outcome: "ok",
      value: { tag: "v1.0.0", state: "unreleased" },
    });
  });

  it("does not take a tag that only starts with the version's tag as its release", () => {
    expect(
      releaseStateOf({
        manifest: manifestAt("1.0.0"),
        previousManifest: manifestAt("0.1.0-pre.6"),
        remoteTags: remoteTagsOf(["v1.0.0-pre.1", "v1.0.0.backup", "release-v1.0.0"]),
      }),
    ).toEqual({ outcome: "ok", value: { tag: "v1.0.0", state: "unreleased" } });
  });

  it("refuses a changed version that is not major.minor.patch with an optional -<identifier>.<number>", () => {
    expect(releaseStateOf({ manifest: manifestAt("1.0"), previousManifest: manifestAt("0.1.0-pre.6"), remoteTags: RELEASED_TAGS })).toEqual({
      outcome: "failed",
      error: "package.json's version 1.0 is not one this workflow releases: major.minor.patch, optionally followed by -<identifier>.<number>",
    });
  });

  it("refuses a manifest without a readable version", () => {
    expect(releaseStateOf({ manifest: "{}", previousManifest: manifestAt("0.1.0-pre.6"), remoteTags: RELEASED_TAGS })).toEqual({
      outcome: "failed",
      error: expect.stringMatching(/^package\.json has no readable version: .*version/s),
    });
  });

  it("refuses the previous manifest without a readable version", () => {
    expect(releaseStateOf({ manifest: manifestAt("0.1.0-pre.7"), previousManifest: "not json", remoteTags: RELEASED_TAGS })).toEqual({
      outcome: "failed",
      error: expect.stringMatching(/^the previous package\.json has no readable version: /),
    });
  });

  it("refuses remote tags it cannot read as git ls-remote lines", () => {
    expect(
      releaseStateOf({ manifest: manifestAt("0.1.0-pre.7"), previousManifest: manifestAt("0.1.0-pre.6"), remoteTags: "v0.1.0-pre.6" }),
    ).toEqual({ outcome: "failed", error: 'cannot read the remote\'s tags: "v0.1.0-pre.6" is not a git ls-remote tag line' });
  });
});

describe("runReleaseState", () => {
  it("prints the tag and state as workflow outputs, says why on standard error and exits 0", () => {
    expect(runWith({ arguments: [manifestAt("0.1.0-pre.7"), manifestAt("0.1.0-pre.6"), RELEASED_TAGS] })).toEqual({
      writes: [[{ text: "tag=v0.1.0-pre.7\nstate=unreleased\n" }]],
      errors: [[{ text: "release-state: this push changes the version to 0.1.0-pre.7 and the remote has no tag v0.1.0-pre.7, so it releases it.\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("says this push releases nothing when the version is unchanged, and exits 0", () => {
    expect(runWith({ arguments: [manifestAt("0.1.0-pre.6"), manifestAt("0.1.0-pre.6"), RELEASED_TAGS] })).toEqual({
      writes: [[{ text: "tag=v0.1.0-pre.6\nstate=version-unchanged\n" }]],
      errors: [[{ text: "release-state: this push leaves the version at 0.1.0-pre.6, so it releases nothing.\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("says this push releases nothing when the version is already released, and exits 0", () => {
    expect(runWith({ arguments: [manifestAt("0.1.0-pre.6"), manifestAt("0.1.0-pre.7"), RELEASED_TAGS] })).toEqual({
      writes: [[{ text: "tag=v0.1.0-pre.6\nstate=already-released\n" }]],
      errors: [[{ text: "release-state: the remote already has the tag v0.1.0-pre.6, so 0.1.0-pre.6 is released and this push releases nothing.\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("exits 1 naming the problem when it cannot decide", () => {
    expect(runWith({ arguments: [manifestAt("1.0"), manifestAt("0.1.0-pre.6"), RELEASED_TAGS] })).toEqual({
      writes: [],
      errors: [
        [
          {
            text: "release-state: package.json's version 1.0 is not one this workflow releases: major.minor.patch, optionally followed by -<identifier>.<number>\n",
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("exits 2 with its usage when an argument is missing", () => {
    expect(runWith({ arguments: [manifestAt("0.1.0-pre.7"), manifestAt("0.1.0-pre.6")] })).toEqual({
      writes: [],
      errors: [[{ text: "usage: release-state <package.json> <previous package.json> <git ls-remote tags>\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});
