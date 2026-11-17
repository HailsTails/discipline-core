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

type VersionCore = { readonly major: number; readonly minor: number; readonly patch: number };

const stable = (request: VersionCore): Version => ({ ...request, preRelease: undefined });

const pre = (request: VersionCore & { readonly number: number }): Version => ({
  major: request.major,
  minor: request.minor,
  patch: request.patch,
  preRelease: { identifier: "pre", number: request.number },
});

describe("versionOf", () => {
  it("reads a stable version", () => {
    expect(versionOf({ text: "1.2.3" })).toEqual({ outcome: "ok", value: stable({ major: 1, minor: 2, patch: 3 }) });
  });

  it("reads a numbered pre-release", () => {
    expect(versionOf({ text: "0.1.0-pre.3" })).toEqual({ outcome: "ok", value: pre({ major: 0, minor: 1, patch: 0, number: 3 }) });
  });

  it.each(["1.2", "v1.2.3", "01.2.3", "1.2.3-pre", "1.2.3-pre.01", "1.2.3+build.1", "1.2.3-pre.1.2"])("refuses %s", (text) => {
    expect(versionOf({ text })).toEqual({
      outcome: "failed",
      error: `${text} is not a version this script prepares: major.minor.patch, optionally followed by -<identifier>.<number>`,
    });
  });
});

describe("versionText", () => {
  it.each([
    { version: stable({ major: 1, minor: 2, patch: 3 }), text: "1.2.3" },
    { version: pre({ major: 0, minor: 1, patch: 0, number: 3 }), text: "0.1.0-pre.3" },
  ])("writes $text", ({ version, text }) => {
    expect(versionText({ version })).toBe(text);
  });
});

describe("channelOf", () => {
  it.each([
    { version: pre({ major: 0, minor: 1, patch: 0, number: 3 }), channel: "pre-release" },
    { version: stable({ major: 1, minor: 2, patch: 3 }), channel: "stable" },
  ] satisfies ReadonlyArray<{ readonly version: Version; readonly channel: ReleaseChannel }>)("puts a version on the $channel channel", ({ version, channel }) => {
    expect(channelOf({ version })).toBe(channel);
  });
});

describe("latestReleaseOf", () => {
  it("picks the highest release tag, ranking a stable release above its pre-releases", () => {
    expect(latestReleaseOf({ tags: ["v0.1.0-pre.1", "v0.1.0", "v0.1.0-pre.3", "v0.1.0-pre.2", "backup-pre1-before-rewrite"] })).toEqual({
      outcome: "ok",
      value: { tag: "v0.1.0", version: stable({ major: 0, minor: 1, patch: 0 }) },
    });
  });

  it("ranks pre-releases by number, not as text", () => {
    expect(latestReleaseOf({ tags: ["v0.1.0-pre.9", "v0.1.0-pre.10", "v0.0.9"] })).toEqual({
      outcome: "ok",
      value: { tag: "v0.1.0-pre.10", version: pre({ major: 0, minor: 1, patch: 0, number: 10 }) },
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
  it("is a major for any breaking subject", () => {
    expect(
      releaseSizeOf({
        entries: [changeEntryOf({ subject: "fix: one" }), changeEntryOf({ subject: "docs!: rename an address" }), changeEntryOf({ subject: "feat: two" })],
      }),
    ).toBe("major");
  });

  it("is a minor for a feature without a breaking subject", () => {
    expect(releaseSizeOf({ entries: [changeEntryOf({ subject: "fix: one" }), changeEntryOf({ subject: "feat: two" })] })).toBe("minor");
  });

  it("is a patch for any other conventional or unclassified subject", () => {
    expect(
      releaseSizeOf({ entries: [changeEntryOf({ subject: "chore: one" }), changeEntryOf({ subject: "Keep versions out of the docs (#20)" })] }),
    ).toBe("patch");
  });

  it("is nothing for no subjects", () => {
    expect(releaseSizeOf({ entries: [] })).toBe("nothing");
  });
});

describe("nextVersionOf", () => {
  it.each([
    { current: pre({ major: 0, minor: 1, patch: 0, number: 3 }), size: "patch", channel: "pre-release", next: pre({ major: 0, minor: 1, patch: 0, number: 4 }) },
    { current: pre({ major: 0, minor: 1, patch: 0, number: 3 }), size: "minor", channel: "pre-release", next: pre({ major: 0, minor: 1, patch: 0, number: 4 }) },
    { current: pre({ major: 0, minor: 1, patch: 0, number: 3 }), size: "major", channel: "pre-release", next: pre({ major: 0, minor: 1, patch: 0, number: 4 }) },
    { current: pre({ major: 0, minor: 1, patch: 0, number: 3 }), size: "patch", channel: "stable", next: stable({ major: 0, minor: 1, patch: 0 }) },
    { current: pre({ major: 0, minor: 1, patch: 1, number: 2 }), size: "minor", channel: "pre-release", next: pre({ major: 0, minor: 2, patch: 0, number: 1 }) },
    { current: pre({ major: 1, minor: 0, patch: 0, number: 2 }), size: "major", channel: "pre-release", next: pre({ major: 1, minor: 0, patch: 0, number: 3 }) },
    { current: pre({ major: 1, minor: 1, patch: 0, number: 2 }), size: "major", channel: "stable", next: stable({ major: 2, minor: 0, patch: 0 }) },
    { current: pre({ major: 1, minor: 1, patch: 0, number: 2 }), size: "minor", channel: "stable", next: stable({ major: 1, minor: 1, patch: 0 }) },
    { current: stable({ major: 1, minor: 2, patch: 3 }), size: "patch", channel: "stable", next: stable({ major: 1, minor: 2, patch: 4 }) },
    { current: stable({ major: 1, minor: 2, patch: 3 }), size: "minor", channel: "stable", next: stable({ major: 1, minor: 3, patch: 0 }) },
    { current: stable({ major: 1, minor: 2, patch: 3 }), size: "major", channel: "stable", next: stable({ major: 2, minor: 0, patch: 0 }) },
    { current: stable({ major: 1, minor: 2, patch: 3 }), size: "major", channel: "pre-release", next: pre({ major: 2, minor: 0, patch: 0, number: 1 }) },
    { current: stable({ major: 0, minor: 3, patch: 4 }), size: "major", channel: "stable", next: stable({ major: 0, minor: 4, patch: 0 }) },
    { current: stable({ major: 0, minor: 3, patch: 4 }), size: "minor", channel: "stable", next: stable({ major: 0, minor: 4, patch: 0 }) },
    { current: stable({ major: 0, minor: 3, patch: 4 }), size: "patch", channel: "stable", next: stable({ major: 0, minor: 3, patch: 5 }) },
  ] satisfies ReadonlyArray<{ readonly current: Version; readonly size: ReleaseSize; readonly channel: ReleaseChannel; readonly next: Version }>)(
    "case $#: a $size change on the $channel channel",
    ({ current, size, channel, next }) => {
      expect(nextVersionOf({ current, size, channel })).toEqual(next);
    },
  );
});
