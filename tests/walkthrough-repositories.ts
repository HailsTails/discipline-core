import type { CommandRequest } from "../core/check/run-check-command.ts";
import { createDefaultExceptionRepositoryOf } from "../core/exception-records/exception-layout.ts";
import { createDefaultDirectoryPort } from "../core/platform-ports/file-system-port.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { createRecordsFolder } from "../core/records/records-folder.ts";
import { installedStagesOver } from "../core/run/version-two-repository.ts";
import { versionTwoCheckCommandOf } from "../core/run/version-two-check-command.ts";
import { type RepoPath, repoPathSchema } from "../core/values/repo-path.ts";
import { ADOPTING_GUIDE_TEXT, reportAsInstalled, workedExampleOf } from "./adopting-guide.ts";
import { gitTreeStub, recordedProcessWith } from "./command-harness.ts";
import { contractTextAt } from "./output-contract.ts";

const WALKTHROUGH = `${import.meta.dirname}/test-fixtures/walkthrough`;

export const BEFORE = `${WALKTHROUGH}/before`;

export const AFTER = `${WALKTHROUGH}/after`;

const ENTRY_URL = new URL("../core/check/tool-command.ts", import.meta.url).href;

export const BEFORE_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("generated/schema.ts"),
  repoPathSchema.parse("hone.config.json"),
  repoPathSchema.parse("src/basket.test.ts"),
  repoPathSchema.parse("src/basket.ts"),
  repoPathSchema.parse("src/utils/format.ts"),
];

export const AFTER_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("generated/schema.ts"),
  repoPathSchema.parse("hone-records/boundaries.json"),
  repoPathSchema.parse("hone.config.json"),
  repoPathSchema.parse("src/basket.test.ts"),
  repoPathSchema.parse("src/basket.ts"),
  repoPathSchema.parse("src/clock.test.ts"),
  repoPathSchema.parse("src/clock.ts"),
  repoPathSchema.parse("src/format.test.ts"),
  repoPathSchema.parse("src/format.ts"),
];

const notUsed = (): never => {
  throw new Error("this port is not used by the check");
};

const trackingGit = (request: { readonly tracked: readonly RepoPath[] }): GitPort => ({
  trackedPaths: () => ({ outcome: "ok", value: request.tracked }),
  changedSince: notUsed,
  contentInBase: notUsed,
  textInBase: notUsed,
});

const commandOver = (request: { readonly tracked: readonly RepoPath[]; readonly process: ProcessPort }): CommandRequest => ({
  process: request.process,
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  git: trackingGit({ tracked: request.tracked }),
  exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  moduleUrl: ENTRY_URL,
});

const checkedOutput = async (request: { readonly repo: string; readonly tracked: readonly RepoPath[] }) => {
  const recorded = recordedProcessWith({ arguments: ["--repo", request.repo] });
  await versionTwoCheckCommandOf({
    gitTree: gitTreeStub(),
    directory: createDefaultDirectoryPort({}),
    recordsSourceOf: createRecordsFolder,
    stagesOver: installedStagesOver,
  })(commandOver({ tracked: request.tracked, process: recorded.port }));
  return { writes: recorded.writes, exits: recorded.exits };
};

const fixtureText = (request: { readonly file: string }): string => contractTextAt({ path: request.file });

export const checkedReport = async (request: { readonly repo: string; readonly tracked: readonly RepoPath[] }) => {
  const ran = await checkedOutput(request);
  return { writes: ran.writes.map(([written]) => ({ text: reportAsInstalled({ text: written.text }) })), exits: ran.exits };
};

export const GUIDE = workedExampleOf({ text: ADOPTING_GUIDE_TEXT });

export const SETTINGS_FILE = { language: "json", body: fixtureText({ file: `${BEFORE}/hone.config.json` }).trimEnd() };

export const RECORDS_FILE = { language: "json", body: fixtureText({ file: `${AFTER}/hone-records/boundaries.json` }).trimEnd() };

export const SETTINGS_TEXT_BEFORE = fixtureText({ file: `${BEFORE}/hone.config.json` });

export const SETTINGS_TEXT_AFTER = fixtureText({ file: `${AFTER}/hone.config.json` });

export const BEFORE_REPORT = { writes: [{ text: `${GUIDE.beforeReport.body}
` }], exits: [[{ code: 1 }]] };

export const AFTER_REPORT = { writes: [{ text: `${GUIDE.afterReport.body}
` }], exits: [[{ code: 0 }]] };
