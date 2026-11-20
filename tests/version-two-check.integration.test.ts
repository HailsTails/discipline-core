import { afterAll, describe, expect, it, vi } from "vitest";
import type { Subcommand } from "../core/check/command-line.ts";
import { TOOL_SUBCOMMANDS } from "../core/check/run-tool-command.ts";
import type { ExceptionRepositoryOf } from "../core/exception-records/exception-records.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultGitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { CHECKS_PROJECTION_PATH, checksProjectionText } from "../mechanisms/eslint/runner/checks-projection.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort } from "../scripts/install-proof-ports.ts";
import { scratchRepositoriesUnder } from "./scratch-repositories.ts";
import { trackedRepositoryWith } from "./tracked-scratch-repository.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const ENTRY_URL = new URL("../core/check/tool-command.ts", import.meta.url).href;

const fileText = createDefaultFileTextPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText, scratch: createDefaultScratchFilesPort({}) });

afterAll(() => {
  repositories.removeAll();
});

const commands = createDefaultCommandRunPort({});

const CONFIG = `{
  "version": 2,
  "exclude": [],
  "ruleSets": {},
  "checks": { "authored-class-or-this#class-keyword": "eslint" },
  "checkSettings": {},
  "conventions": {},
  "layers": {}
}
`;

const PROJECTION_IMPORT = `import hone from "./${CHECKS_PROJECTION_PATH}";\nexport default [...hone];\n`;

const PROJECTION = checksProjectionText({
  pluginImport: "../../api/eslint-plugin.ts",
  checks: [{ symptom: "authored-class-or-this", check: "class-keyword", ruleId: "hone/authored-class-or-this/class-keyword", options: [] }],
  answered: [],
});

const EXPECTED_REPORT = `findings (1)
authored-class-or-this#class-keyword eslint kept.ts:1:7 export class Kept {} may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
uncovered (1)
authored-class-or-this#static-members-only
symptoms (1)
authored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. Known debt: debt. Read ../../rules/typescript/symptoms.md#authored-class-or-this
verdict: fail
`;

const runCommandIn = async (request: { readonly repo: string; readonly subcommand: Subcommand; readonly options: readonly string[] }) => {
  const processPort: ProcessPort = {
    arguments: ["--repo", request.repo, ...request.options],
    writeOut: vi.fn<ProcessPort["writeOut"]>(),
    writeError: vi.fn<ProcessPort["writeError"]>(),
    exitWith: vi.fn<ProcessPort["exitWith"]>(),
  };
  await TOOL_SUBCOMMANDS[request.subcommand]({
    process: processPort,
    path: createDefaultPathPort({}),
    fileText,
    modules: createDefaultModuleLoaderPort({}),
    git: createDefaultGitPort({}),
    exceptionRepositoryOf: vi.fn<ExceptionRepositoryOf>(),
    moduleUrl: ENTRY_URL,
  });
  return { writes: vi.mocked(processPort.writeOut).mock.calls, exits: vi.mocked(processPort.exitWith).mock.calls };
};

describe("the tool's commands on a repository holding hone.config.json, through the real ports", () => {
  it("prints the version 2 report for a class the ESLint runner finds, naming the check and the symptom, and exits 1", async () => {
    const repo = trackedRepositoryWith({
      repositories,
      commands,
      files: { "hone.config.json": CONFIG, "eslint.config.mjs": PROJECTION_IMPORT, [CHECKS_PROJECTION_PATH]: PROJECTION, "kept.ts": "export class Kept {}\n" },
    });
    expect(await runCommandIn({ repo, subcommand: "check", options: [] })).toEqual({ writes: [[{ text: EXPECTED_REPORT }]], exits: [[{ code: 1 }]] });
  });

  it("records the class the base revision holds as debt through record-debt, printing the symptom and file and exiting 0", async () => {
    const repo = trackedRepositoryWith({
      repositories,
      commands,
      files: { "hone.config.json": CONFIG, "eslint.config.mjs": PROJECTION_IMPORT, [CHECKS_PROJECTION_PATH]: PROJECTION, "kept.ts": "export class Kept {}\n" },
    });
    commands.run({ command: "git", arguments: ["-c", "user.name=proof", "-c", "user.email=proof@example.test", "commit", "-m", "base"], directory: repo });
    const recorded = await runCommandIn({ repo, subcommand: "record-debt", options: ["--base-revision", "HEAD"] });
    expect(recorded).toEqual({ writes: [[{ text: "authored-class-or-this#class-keyword recorded kept.ts\n" }]], exits: [[{ code: 0 }]] });  });

  it("prints one not-ready-yet line for project and exits 2", async () => {
    const repo = repositories.repositoryWith({ files: { "hone.config.json": CONFIG } });
    expect(await runCommandIn({ repo, subcommand: "project", options: [] })).toEqual({
      writes: [[{ text: "load failure: not-ready-yet project: this release runs project on version 1 files only, and this repository holds hone.config.json\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});
