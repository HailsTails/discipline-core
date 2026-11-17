import { describe, expect, it } from "vitest";
import { changeEntryOf } from "./conventional-subject.ts";
import {
  channelOf,
  latestReleaseOf,
  nextVersionOf,
  type ReleaseChannel,
  type ReleaseSize,
  releaseSizeOf,
  type Version,
  versionOf,
  versionText,
} from "./release-version.ts";

const parsed = (request: { readonly text: string }): Version => {
  const version = versionOf(request);
  if (version.outcome === "failed") {
    throw new Error(version.error);
  }
  return version.value;
};

describe("versionOf", () => {
  it("reads a stable version", () => {
    expect(versionOf({ text: "1.2.3" })).toEqual({ outcome: "ok", value: { major: 1, minor: 2, patch: 3, preRelease: undefined } });
  });

  it("reads a numbered pre-release", () => {
    expect(versionOf({ text: "0.1.0-pre.3" })).toEqual({
      outcome: "ok",
      value: { major: 0, minor: 1, patch: 0, preRelease: { identifier: "pre", number: 3 } },
    });
  });

  it.each(["1.2", "v1.2.3", "01.2.3", "1.2.3-pre", "1.2.3-pre.01", "1.2.3+build.1", "1.2.3-pre.1.2"])("refuses %s", (text) => {
    expect(versionOf({ text })).toEqual({
      outcome: "failed",
      error: `${text} is not a version this script prepares: major.minor.patch, optionally followed by -<identifier>.<number>`,
    });
  });

  it.each(["1.2.3", "0.1.0-pre.3"])("writes %s back as it was read", (text) => {
    expect(versionText({ version: parsed({ text }) })).toBe(text);
  });
});

describe("channelOf", () => {
  it.each([
    ["0.1.0-pre.3", "pre-release"],
    ["1.2.3", "stable"],
  ] as const)("puts %s on the %s channel", (text, channel) => {
    expect(channelOf({ version: parsed({ text }) })).toBe(channel);
  });
});

describe("latestReleaseOf", () => {
  it("picks the highest release tag, ranking a stable release above its pre-releases", () => {
    expect(latestReleaseOf({ tags: ["v0.1.0-pre.1", "v0.1.0", "v0.1.0-pre.3", "v0.1.0-pre.2", "backup-pre1-before-rewrite"] })).toEqual({
      outcome: "ok",
      value: { tag: "v0.1.0", version: parsed({ text: "0.1.0" }) },
    });
  });

  it("ranks pre-releases by number, not as text", () => {
    expect(latestReleaseOf({ tags: ["v0.1.0-pre.9", "v0.1.0-pre.10", "v0.0.9"] })).toEqual({
      outcome: "ok",
      value: { tag: "v0.1.0-pre.10", version: parsed({ text: "0.1.0-pre.10" }) },
    });
  });

  it("fails when no tag is a release tag", () => {
    expect(latestReleaseOf({ tags: ["backup-pre1-before-rewrite", "vnext"] })).toEqual({
      outcome: "failed",
      error: "no release tag v<version> is merged into HEAD",
    });
  });
});

describe("releaseSizeOf", () => {
  const sizeOf = (subjects: readonly string[]) => releaseSizeOf({ entries: subjects.map((subject) => changeEntryOf({ subject })) });

  it("is a major for any breaking subject", () => {
    expect(sizeOf(["fix: one", "docs!: rename an address", "feat: two"])).toBe("major");
  });

  it("is a minor for a feature without a breaking subject", () => {
    expect(sizeOf(["fix: one", "feat: two"])).toBe("minor");
  });

  it("is a patch for any other conventional or unclassified subject", () => {
    expect(sizeOf(["chore: one", "Keep versions out of the docs (#20)"])).toBe("patch");
  });

  it("is nothing for no subjects", () => {
    expect(sizeOf([])).toBe("nothing");
  });
});

describe("nextVersionOf", () => {
  it.each([
    ["0.1.0-pre.3", "patch", "pre-release", "0.1.0-pre.4"],
    ["0.1.0-pre.3", "minor", "pre-release", "0.1.0-pre.4"],
    ["0.1.0-pre.3", "major", "pre-release", "0.1.0-pre.4"],
    ["0.1.0-pre.3", "patch", "stable", "0.1.0"],
    ["0.1.1-pre.2", "minor", "pre-release", "0.2.0-pre.1"],
    ["1.0.0-pre.2", "major", "pre-release", "1.0.0-pre.3"],
    ["1.1.0-pre.2", "major", "stable", "2.0.0"],
    ["1.1.0-pre.2", "minor", "stable", "1.1.0"],
    ["1.2.3", "patch", "stable", "1.2.4"],
    ["1.2.3", "minor", "stable", "1.3.0"],
    ["1.2.3", "major", "stable", "2.0.0"],
    ["1.2.3", "major", "pre-release", "2.0.0-pre.1"],
    ["0.3.4", "major", "stable", "0.4.0"],
    ["0.3.4", "minor", "stable", "0.4.0"],
    ["0.3.4", "patch", "stable", "0.3.5"],
  ] satisfies ReadonlyArray<readonly [string, ReleaseSize, ReleaseChannel, string]>)(
    "takes %s with a %s change on the %s channel to %s",
    (current, size, channel, next) => {
      expect(versionText({ version: nextVersionOf({ current: parsed({ text: current }), size, channel }) })).toBe(next);
    },
  );
});
