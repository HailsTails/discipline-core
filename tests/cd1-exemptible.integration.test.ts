import { afterAll, assert, describe, expect, it, vi } from "vitest";
import { createDefaultScratchFilesPort } from "../scripts/install-proof-ports.ts";
import { withSingleFileRecords, } from "./records-disk.ts";
import { NO_TEXT_FILES, restoredFixtureRepositoriesOver } from "./restored-fixture-repository.ts";
import { scratchRepositoriesUnder } from "./scratch-repositories.ts";
import { runCheck } from "../core/check/run-check.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { DEFAULT_ASSESSMENT } from "../core/values/assessment.ts";
import { type RepoPath, repoPathSchema } from "../core/values/repo-path.ts";
import { fullReportExitCode } from "./full-report-exit-code.ts";

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const git: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
    outcome: "ok",
    value: [
      repoPathSchema.parse("discipline-exceptions.json"),
      repoPathSchema.parse("disciplines.json"),
      repoPathSchema.parse("src/fresh.ts"),
      repoPathSchema.parse("src/parse.ts"),
    ],
  }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
};

describe("the shipped CD-1 rule, read from rules/CD-1/discipline.json through a full check (CD-47: the shipped rule file is the assertion's subject; nothing is spawned or written)", () => {
  it("accepts an authorised location for CD-1 and still flags an unrecorded any cast", async () => {
    const report = await runCheck(withSingleFileRecords({
      repoRoot: resolvedPath({ path: `${import.meta.dirname}/test-fixtures/cd1-exempted` }),
      installRoot: resolvedPath({ path: `${import.meta.dirname}/..` }),
      moduleExtension: ".ts",
      baseRevision: undefined,
      assessment: DEFAULT_ASSESSMENT,
      fileText: createDefaultFileTextPort({}),
      modules: createDefaultModuleLoaderPort({}),
      path,
      git,
    }));
    expect(report).toMatchObject({
      outcome: "ok",
      value: {
        invalidRecords: [],
        findings: [{ clause: { discipline: "CD-1", clause: "any-cast" }, file: "src/fresh.ts" }],
        exempted: [{ finding: { file: "src/parse.ts" }, by: [{ kind: "authorised-location" }] }],
      },
    });
  });
});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: resolvedPath({ path: `${import.meta.dirname}/../artefacts` }), fileText: createDefaultFileTextPort({}), scratch });

afterAll(() => {
  repositories.removeAll();
});

const CASCADE_REPO = restoredFixtureRepositoriesOver({ repositories, scratch, fileText: createDefaultFileTextPort({}), path }).restoredFrom({
  fixtureRoot: resolvedPath({ path: `${import.meta.dirname}/test-fixtures/cd1-cascade` }),
  textFiles: NO_TEXT_FILES,
});

const LEGACY_FILE = repoPathSchema.parse("src/legacy.ts");

const cascadeCheck = (request: { readonly changed: readonly RepoPath[] }) => {
  const cascadeGit: GitPort = {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
      outcome: "ok",
      value: [
        repoPathSchema.parse("discipline-exceptions.json"),
        repoPathSchema.parse("disciplines.json"),
        LEGACY_FILE,
      ],
    }),
    changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: request.changed }),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
  };
  return runCheck(withSingleFileRecords({
    repoRoot: CASCADE_REPO,
    installRoot: resolvedPath({ path: `${import.meta.dirname}/..` }),
    moduleExtension: ".ts",
    baseRevision: "origin/main",
    assessment: DEFAULT_ASSESSMENT,
    fileText: createDefaultFileTextPort({}),
    modules: createDefaultModuleLoaderPort({}),
    path,
    git: cascadeGit,
  }));
};

describe("adopting a repository whose legacy file holds CD-1 debt beside another discipline's debt (CD-47: the shipped rules and the fixture's own files are the assertion's subject; nothing is spawned or written)", () => {
  it("passes with the file untouched and every carve-out, the CD-1 ones included, still in force", async () => {
    const cascadeReport = await cascadeCheck({ changed: [] });
    expect(cascadeReport).toMatchObject({
      outcome: "ok",
      value: {
        findings: [],
        invalidRecords: [],
        forfeited: [],
        exempted: expect.arrayContaining([
          expect.objectContaining({ finding: expect.objectContaining({ clause: { ruleSet: "hone", discipline: "CD-1", clause: "any-cast" } }) }),
          expect.objectContaining({ finding: expect.objectContaining({ clause: { ruleSet: "hone", discipline: "CD-1", clause: "explicit-any" } }) }),
          expect.objectContaining({ finding: expect.objectContaining({ clause: { ruleSet: "hone", discipline: "CD-15", clause: "loops" } }) }),
        ]),
      },
    });
    expect(fullReportExitCode({ checked: cascadeReport })).toBe(0);
  });

  it("forfeits all three carve-outs once the file is touched, the ordinary touch-and-own for any discipline", async () => {
    const cascadeReport = await cascadeCheck({ changed: [LEGACY_FILE] });
    expect(cascadeReport).toMatchObject({ outcome: "ok", value: { forfeited: [{}, {}, {}] } });
    expect(fullReportExitCode({ checked: cascadeReport })).toBe(1);
  });
});
