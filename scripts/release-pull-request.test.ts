import { describe, expect, it, vi } from "vitest";
import type { GitHistoryPort } from "../core/platform-ports/git-port.ts";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { inMemoryFiles } from "../tests/in-memory-files.ts";
import { runReleasePullRequest } from "./release-pull-request.ts";

const MODULE_URL = "file:///repo/scripts/release-pull-request-command.ts";

const CHANGELOG = "# Changelog\n\nIntro.\n\n## 0.1.0-pre.3\n\n### Fixes\n\n- stage releases\n";

const MANIFEST = '{\n  "version": "0.1.0-pre.3",\n  "private": true\n}\n';

const TAGS = ["v0.1.0-pre.1", "v0.1.0-pre.3", "v0.1.0-pre.2", "backup-pre1-before-rewrite"];

const SUBJECTS = ["feat(release): prepare release pull requests (#33)", "Keep versions out of the docs (#20)"];

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const historyWith = (request: {
  readonly tags: ReturnType<GitHistoryPort["mergedTags"]>;
  readonly subjects: ReturnType<GitHistoryPort["subjectsAfter"]>;
}): GitHistoryPort => ({
  mergedTags: vi.fn<GitHistoryPort["mergedTags"]>().mockReturnValue(request.tags),
  subjectsAfter: vi.fn<GitHistoryPort["subjectsAfter"]>().mockReturnValue(request.subjects),
});

const runWith = (request: {
  readonly arguments?: readonly string[];
  readonly files?: Readonly<Record<string, string>>;
  readonly tags?: ReturnType<GitHistoryPort["mergedTags"]>;
  readonly subjects?: ReturnType<GitHistoryPort["subjectsAfter"]>;
}) => {
  const processPort = processWith({ arguments: request.arguments ?? [] });
  const files = inMemoryFiles({ initial: request.files ?? { "/repo/CHANGELOG.md": CHANGELOG, "/repo/package.json": MANIFEST } });
  const history = historyWith({
    tags: request.tags ?? { outcome: "ok", value: TAGS },
    subjects: request.subjects ?? { outcome: "ok", value: SUBJECTS },
  });
  runReleasePullRequest({
    process: processPort,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" }),
    fileText: files.fileText,
    history,
    moduleUrl: MODULE_URL,
  });
  return {
    history,
    texts: files.texts(),
    writes: vi.mocked(processPort.writeOut).mock.calls,
    errors: vi.mocked(processPort.writeError).mock.calls,
    exits: vi.mocked(processPort.exitWith).mock.calls,
  };
};

const UNCHANGED = { "/repo/CHANGELOG.md": CHANGELOG, "/repo/package.json": MANIFEST };

describe("runReleasePullRequest preparing a release", () => {
  it("reads the subjects merged since the latest release tag at the repository root", () => {
    const run = runWith({});

    expect(vi.mocked(run.history.mergedTags).mock.calls).toEqual([[{ repoRoot: "/repo", pattern: "v*" }]]);
    expect(vi.mocked(run.history.subjectsAfter).mock.calls).toEqual([[{ repoRoot: "/repo", revision: "v0.1.0-pre.3" }]]);
  });

  it("writes the next pre-release's section into the changelog and its version into package.json, and says it made no tag", () => {
    const run = runWith({});

    expect(run.texts).toEqual({
      "/repo/CHANGELOG.md":
        "# Changelog\n\nIntro.\n\n## 0.1.0-pre.4\n\n### Features\n\n- release: prepare release pull requests (#33)\n\n### Other changes\n\n- Keep versions out of the docs (#20)\n\n## 0.1.0-pre.3\n\n### Fixes\n\n- stage releases\n",
      "/repo/package.json": '{\n  "version": "0.1.0-pre.4",\n  "private": true\n}\n',
    });
    expect(run.writes).toEqual([
      [
        {
          text: "release-pull-request: 0.1.0-pre.3 to 0.1.0-pre.4, a minor change on the pre-release channel, from 2 subjects since v0.1.0-pre.3. CHANGELOG.md and package.json are updated in the working tree; no tag was made and nothing was published.\n",
        },
      ],
    ]);
    expect(run.exits).toEqual([[{ code: 0 }]]);
  });

  it("warns about each subject that is not conventional, which it lists as a patch under other changes", () => {
    expect(runWith({}).errors).toEqual([
      [{ text: 'release-pull-request: "Keep versions out of the docs (#20)" is not a conventional subject; it is listed under Other changes and counted as a patch.\n' }],
    ]);
  });

  it("counts a single subject in the singular", () => {
    expect(runWith({ subjects: { outcome: "ok", value: ["fix: one"] } }).writes).toEqual([
      [
        {
          text: "release-pull-request: 0.1.0-pre.3 to 0.1.0-pre.4, a patch change on the pre-release channel, from 1 subject since v0.1.0-pre.3. CHANGELOG.md and package.json are updated in the working tree; no tag was made and nothing was published.\n",
        },
      ],
    ]);
  });

  it("finishes a pre-release on the stable channel when asked", () => {
    const run = runWith({ arguments: ["stable"] });

    expect(run.texts["/repo/package.json"]).toBe('{\n  "version": "0.1.0",\n  "private": true\n}\n');
    expect(run.texts["/repo/CHANGELOG.md"]).toContain("## 0.1.0\n");
  });
});

describe("runReleasePullRequest refusing on the repository's state", () => {
  it("refuses to prepare a release with no subjects since the tag", () => {
    const run = runWith({ subjects: { outcome: "ok", value: [] } });

    expect(run).toMatchObject({
      texts: UNCHANGED,
      writes: [],
      errors: [[{ text: "release-pull-request: nothing is merged since v0.1.0-pre.3, so there is nothing to release.\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("refuses when package.json is not at the latest release's version", () => {
    const run = runWith({ files: { "/repo/CHANGELOG.md": CHANGELOG, "/repo/package.json": '{ "version": "0.1.0-pre.4" }\n' } });

    expect(run).toMatchObject({
      texts: { "/repo/CHANGELOG.md": CHANGELOG, "/repo/package.json": '{ "version": "0.1.0-pre.4" }\n' },
      writes: [],
      errors: [
        [
          {
            text: "release-pull-request: package.json is at 0.1.0-pre.4, not v0.1.0-pre.3's 0.1.0-pre.3, so a release is already prepared or the tag is missing.\n",
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("refuses when the changelog already has the next version", () => {
    const run = runWith({ files: { "/repo/CHANGELOG.md": `${CHANGELOG}\n## 0.1.0-pre.4\n`, "/repo/package.json": MANIFEST } });

    expect(run).toMatchObject({
      writes: [],
      errors: [[{ text: "release-pull-request: CHANGELOG.md already has a section for 0.1.0-pre.4\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("refuses when no release tag is merged", () => {
    const run = runWith({ tags: { outcome: "ok", value: ["backup-pre1-before-rewrite"] } });

    expect(run).toMatchObject({
      texts: UNCHANGED,
      errors: [[{ text: "release-pull-request: no release tag v<version> is merged into HEAD\n" }]],
      exits: [[{ code: 1 }]],
    });
  });
});

describe("runReleasePullRequest refusing on failures and usage", () => {
  it("refuses when git fails", () => {
    const run = runWith({
      subjects: { outcome: "failed", error: { kind: "git-failed", command: "git log", detail: "fatal: bad revision" } },
    });

    expect(run).toMatchObject({
      texts: UNCHANGED,
      errors: [[{ text: "release-pull-request: git log failed: fatal: bad revision\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("refuses when package.json has no version it can read", () => {
    const run = runWith({ files: { "/repo/CHANGELOG.md": CHANGELOG, "/repo/package.json": '{ "private": true }\n' } });

    expect(run).toMatchObject({
      errors: [[{ text: expect.stringMatching(/^release-pull-request: package\.json has no readable version: .*version/s) }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("refuses when a file cannot be read", () => {
    const run = runWith({ files: { "/repo/package.json": MANIFEST } });

    expect(run).toMatchObject({
      errors: [[{ text: "release-pull-request: cannot read /repo/CHANGELOG.md: ENOENT\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it.each([[["beta"]], [["stable", "stable"]]])("exits 2 with its usage for the arguments %j", (releaseArguments) => {
    const run = runWith({ arguments: releaseArguments });

    expect(run).toMatchObject({
      texts: UNCHANGED,
      errors: [[{ text: "usage: release-pull-request [pre-release|stable]\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});
