import { assert, describe, expect, it, vi } from "vitest";
import { withSingleFileRecords, withSingleFileRecordsOf } from "./records-disk.ts";
import { guidedCheckCommandOutcome } from "../core/command-line/command-outcome.ts";
import { runCheck } from "../core/check/run-check.ts";
import { runGuidedCheckCommand } from "../core/check/run-guided-check-command.ts";
import { symptomGuideIn } from "../core/check/symptom-guide.ts";
import { createSymptomCatalogueRepository } from "../core/symptom-catalogue/read-symptom-catalogue.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { DEFAULT_ASSESSMENT } from "../core/values/assessment.ts";
import { type RepoPath, repoPathSchema } from "../core/values/repo-path.ts";
import expectedReports from "./test-fixtures/walkthrough/expected-reports.json" with { type: "json" };

const PROJECT_COMMAND = "node core/check/tool-command.ts project --repo .";

const PRUNE_COMMAND = "node core/check/tool-command.ts prune-debt --repo .";

const path = createDefaultPathPort({});

const ENTRY_URL = new URL("../core/check/tool-command.ts", import.meta.url).href;

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/..` });
const BEFORE = resolvedPath({ path: `${import.meta.dirname}/test-fixtures/walkthrough/before` });
const AFTER = resolvedPath({ path: `${import.meta.dirname}/test-fixtures/walkthrough/after` });

const BEFORE_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("generated/schema.ts"),
  repoPathSchema.parse("src/basket.test.ts"),
  repoPathSchema.parse("src/basket.ts"),
  repoPathSchema.parse("src/utils/format.ts"),
];

const AFTER_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("discipline-exceptions.json"),
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("generated/schema.ts"),
  repoPathSchema.parse("src/basket.test.ts"),
  repoPathSchema.parse("src/basket.ts"),
  repoPathSchema.parse("src/clock.test.ts"),
  repoPathSchema.parse("src/clock.ts"),
  repoPathSchema.parse("src/format.test.ts"),
  repoPathSchema.parse("src/format.ts"),
];

const trackingGit = (request: { readonly tracked: readonly RepoPath[] }): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: request.tracked }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
});

const checkedText = async (request: { readonly repo: AbsolutePath; readonly tracked: readonly RepoPath[] }) => {
  const checked = await runCheck(withSingleFileRecords({
    repoRoot: request.repo,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    baseRevision: undefined,
    assessment: DEFAULT_ASSESSMENT,
    fileText: createDefaultFileTextPort({}),
    modules: createDefaultModuleLoaderPort({}),
    path,
    git: trackingGit({ tracked: request.tracked }),
  }));
  assert(checked.outcome === "ok", `${request.repo} loads`);
  const guide = symptomGuideIn({
    path,
    fileText: createDefaultFileTextPort({}),
    repoRoot: request.repo,
    installRoot: INSTALL_ROOT,
    symptomCatalogueOf: createSymptomCatalogueRepository,
  });
  return guidedCheckCommandOutcome({
    result: { outcome: "ok", value: { report: checked.value, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, guide } },
  });
};

const commandOutput = async (request: { readonly repo: AbsolutePath; readonly tracked: readonly RepoPath[] }) => {
  const processPort: ProcessPort = {
    arguments: ["--repo", request.repo],
    writeOut: vi.fn<ProcessPort["writeOut"]>(),
    writeError: vi.fn<ProcessPort["writeError"]>(),
    exitWith: vi.fn<ProcessPort["exitWith"]>(),
  };
  await runGuidedCheckCommand(
    withSingleFileRecordsOf({
      process: processPort,
      path,
      fileText: createDefaultFileTextPort({}),
      modules: createDefaultModuleLoaderPort({}),
      git: trackingGit({ tracked: request.tracked }),
      moduleUrl: ENTRY_URL,
    }),
  );
  return { writes: vi.mocked(processPort.writeOut).mock.calls, exits: vi.mocked(processPort.exitWith).mock.calls };
};



describe("the adopter walkthrough's sample repository, checked against this install through the default runners (CD-47: the shipped pieces and the fixture's own files are the assertion's subject; nothing is spawned or written)", () => {
  it("fails before the fix with one finding per violation and none in the excluded generated folder, exiting 1", async () => {
    expect(await checkedText({ repo: BEFORE, tracked: BEFORE_TRACKED })).toEqual({ code: 1, text: expectedReports.before });
  });

  it("passes after the fix with the clock adapter exempted by its authorised location, exiting 0", async () => {
    expect(await checkedText({ repo: AFTER, tracked: AFTER_TRACKED })).toEqual({ code: 0, text: expectedReports.after });
  });
});

describe("the walkthrough reports printed by the check command when neither --report-output nor disciplines.json sets an output", () => {
  it("prints the before report byte for byte and exits 1", async () => {
    expect(await commandOutput({ repo: BEFORE, tracked: BEFORE_TRACKED })).toEqual({
      writes: [[{ text: expectedReports.before }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("prints the after report byte for byte and exits 0", async () => {
    expect(await commandOutput({ repo: AFTER, tracked: AFTER_TRACKED })).toEqual({
      writes: [[{ text: expectedReports.after }]],
      exits: [[{ code: 0 }]],
    });
  });
});
