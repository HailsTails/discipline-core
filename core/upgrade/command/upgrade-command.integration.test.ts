import { afterAll, describe, expect, it, vi } from "vitest";
import { TOOL_SUBCOMMANDS } from "../../check/run-tool-command.ts";
import { createDefaultExceptionRepositoryOf } from "../../exception-records/exception-layout.ts";
import type { Subcommand } from "../../command-line/command-line.ts";
import { createDefaultFileTextPort } from "../../platform-ports/file-text-port.ts";
import { createDefaultGitPort } from "../../platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../../platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../../platform-ports/path-port.ts";
import type { ProcessPort } from "../../platform-ports/process-port.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort } from "../../../scripts/install-proof-ports.ts";
import { listedPathsOf, treeOf } from "../../../tests/repository-tree.ts";
import { checkModulesOn, ESLINT_LINES, type EslintLine } from "../../../tests/eslint-toolchains.ts";
import { scratchRepositoriesUnder } from "../../../tests/scratch-repositories.ts";
import { repositoryWithSubfolder } from "../../../tests/subfolder-scratch-repository.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../..`);

const ENTRY_URL = new URL("../../check/tool-command.ts", import.meta.url).href;

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText, scratch });

afterAll(() => {
  repositories.removeAll();
});

const commands = createDefaultCommandRunPort({});

const SELECTION = '{ "version": 1, "ruleSets": {}, "clauses": { "CD-14#class-syntax": "eslint", "CD-14#static-only-class": "eslint" } }\n';

const EXCEPTIONS = '{ "version": 1, "exceptions": [{ "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "src/kept.ts", "reason": "legacy class" }] }\n';

const TEAM_CONFIG = 'import projection from "./disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...projection];\n';

const VERSION_ONE_FILES: Readonly<Record<string, string>> = {
  "disciplines.json": SELECTION,
  "discipline-exceptions.json": EXCEPTIONS,
  "eslint.config.mjs": TEAM_CONFIG,
};

const DEFAULT_MODULES = createDefaultModuleLoaderPort({});

const runCommandIn = async (request: {
  readonly repo: string;
  readonly subcommand: Subcommand;
  readonly options: readonly string[];
  readonly modules: ModuleLoaderPort;
}) => {
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
    modules: request.modules,
    git: createDefaultGitPort({}),
    exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
    moduleUrl: ENTRY_URL,
  });
  return { writes: vi.mocked(processPort.writeOut).mock.calls, exits: vi.mocked(processPort.exitWith).mock.calls };
};

const trackEverything = (request: { readonly repo: string }): void => {
  commands.run({ command: "git", arguments: ["add", "."], directory: request.repo });
};

const KEPT_CLASS = "export class Kept {}\n";

const NO_RECORDS = '{ "version": 1, "exceptions": [] }\n';

const versionOneRepository = async (request: { readonly source: string; readonly exceptions: string }): Promise<string> => {
  const repo = repositoryWithSubfolder({
    repositories,
    scratch,
    fileText,
    files: { ...VERSION_ONE_FILES, "discipline-exceptions.json": request.exceptions },
    subfolder: "src",
    subfolderFiles: { "kept.ts": request.source },
  });
  commands.run({ command: "git", arguments: ["init"], directory: repo });
  trackEverything({ repo });
  await runCommandIn({ repo, subcommand: "project", options: [], modules: DEFAULT_MODULES });
  trackEverything({ repo });
  return repo;
};

const commitEverything = (request: { readonly repo: string }): void => {
  commands.run({ command: "git", arguments: ["-c", "user.name=proof", "-c", "user.email=proof@example.test", "commit", "-m", "base"], directory: request.repo });
};

describe("hone upgrade over a real repository, through the real ports", () => {
  it("upgrades a version 1 repository, checks it with the projection current, and finds nothing left to upgrade", async () => {
    const repo = await versionOneRepository({ source: KEPT_CLASS, exceptions: EXCEPTIONS });
    const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules: DEFAULT_MODULES });
    trackEverything({ repo });
    const checked = await runCommandIn({ repo, subcommand: "check", options: ["--forfeiture", "elsewhere"], modules: DEFAULT_MODULES });
    const again = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules: DEFAULT_MODULES });
    expect({ upgraded, checked, again }).toEqual({
      upgraded: {
        writes: [
          [
            {
              text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nrewrote eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved disciplines.json\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      checked: {
        writes: [
          [
            {
              text: "answered (1)\nauthored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} answered by debt\nassessment (1)\nforfeiture elsewhere: 1 debt record not checked for forfeiture in this run\nverdict: pass (partial assessment)\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      again: { writes: [[{ text: "already on version 2; nothing to upgrade\n" }]], exits: [[{ code: 0 }]] },
    });
  });

  it("refuses a carve-out that answers no finding, and leaves every file of the repository byte for byte as it was", async () => {
    const repo = await versionOneRepository({ source: "export const kept = 1;\n", exceptions: EXCEPTIONS });
    const before = treeOf({ repo });
    const refused = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules: DEFAULT_MODULES });
    expect({ refused, after: treeOf({ repo }) }).toEqual({
      refused: {
        writes: [
          [
            {
              text: "upgrade refused:\nthe file carve-out for CD-14#class-syntax in src/kept.ts answers no finding. Remove it, or fix the file it names, then run the upgrade again.\nNothing was changed.\n",
            },
          ],
        ],
        exits: [[{ code: 1 }]],
      },
      after: before,
    });
  });

  it("upgrades a repository whose records are split, and checks it against a real git base revision", async () => {
    const repo = await versionOneRepository({ source: KEPT_CLASS, exceptions: EXCEPTIONS });
    await runCommandIn({ repo, subcommand: "split-records", options: [], modules: DEFAULT_MODULES });
    trackEverything({ repo });
    commitEverything({ repo });
    const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules: DEFAULT_MODULES });
    trackEverything({ repo });
    const checked = await runCommandIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"], modules: DEFAULT_MODULES });
    expect({ upgraded, checked }).toEqual({
      upgraded: {
        writes: [
          [
            {
              text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nrewrote eslint.config.mjs\nremoved discipline-exceptions/file-carve-outs/cd-14.json\nremoved disciplines.eslint.mjs\nremoved disciplines.json\nremoved discipline-exceptions/file-carve-outs\nremoved discipline-exceptions\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      checked: {
        writes: [[{ text: "answered (1)\nauthored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} answered by debt\nverdict: pass\n" }]],
        exits: [[{ code: 0 }]],
      },
    });
  });

  it("removes a single records file that holds no records, and reports only what it removed", async () => {
    const repo = await versionOneRepository({ source: "export const kept = 1;\n", exceptions: NO_RECORDS });
    const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules: DEFAULT_MODULES });
    expect({ upgraded, after: listedPathsOf({ repo }) }).toEqual({
      upgraded: {
        writes: [[{ text: "upgraded to version 2\nwrote hone.config.json\nwrote hone.eslint.mjs\nrewrote eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved disciplines.json\n" }]],
        exits: [[{ code: 0 }]],
      },
      after: ["eslint.config.mjs", "hone.config.json", "hone.eslint.mjs", "src/", "src/kept.ts"],
    });
  });

  it("removes a split records folder whose kind folder was emptied by an earlier prune", async () => {
    const repo = await versionOneRepository({ source: KEPT_CLASS, exceptions: EXCEPTIONS });
    await runCommandIn({ repo, subcommand: "split-records", options: [], modules: DEFAULT_MODULES });
    scratch.makeDirectory({ path: absolutePathSchema.parse(`${repo}/discipline-exceptions/authorised-locations`) });
    trackEverything({ repo });
    const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules: DEFAULT_MODULES });
    expect({ upgraded, after: listedPathsOf({ repo }) }).toEqual({
      upgraded: {
        writes: [
          [
            {
              text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nrewrote eslint.config.mjs\nremoved discipline-exceptions/file-carve-outs/cd-14.json\nremoved disciplines.eslint.mjs\nremoved disciplines.json\nremoved discipline-exceptions/authorised-locations\nremoved discipline-exceptions/file-carve-outs\nremoved discipline-exceptions\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      after: ["eslint.config.mjs", "hone-records/", "hone-records/debt/", "hone-records/debt/authored-class-or-this.json", "hone.config.json", "hone.eslint.mjs", "src/", "src/kept.ts"],
    });
  });
});

const PACKAGE_SELECTION = '{ "version": 1, "ruleSets": {}, "clauses": { "CD-14#class-syntax": "eslint", "CD-14#static-only-class": "eslint" } }\n';

const DECLARED_SELECTION =
  '{ "version": 1, "ruleSets": {}, "eslintConfigLookup": "repository-root", "eslintConfigRoots": ["packages/a"], "clauses": { "CD-14#class-syntax": "eslint", "CD-14#static-only-class": "eslint" } }\n';

const PACKAGE_CARVE_OUT = '{ "version": 1, "exceptions": [{ "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "packages/a/kept.ts", "reason": "legacy class" }] }\n';

const PACKAGE_CONFIG = 'import projection from "./disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...projection];\n';

const ROOT_CONFIG_IMPORTING_PACKAGE_SLICE =
  'import projection from "./disciplines.eslint.mjs";\nimport packageProjection from "./packages/a/disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...packageProjection, ...projection];\n';

const UNPROJECTING_PACKAGE_CONFIG = 'export default [{ files: ["**/*.{ts,tsx,mts,cts}"] }];\n';

const ROOT_CARVE_OUT = '{ "version": 1, "exceptions": [{ "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "kept.ts", "reason": "legacy class" }] }\n';

const PACKAGE_SOURCE = "export const kept = 1;\n";

const packageRepository = async (request: {
  readonly line: EslintLine;
  readonly files: Readonly<Record<string, string>>;
  readonly packageFiles: Readonly<Record<string, string>>;
}): Promise<string> => {
  const repo = repositoryWithSubfolder({
    repositories,
    scratch,
    fileText,
    files: request.files,
    subfolder: "packages/a",
    subfolderFiles: request.packageFiles,
  });
  commands.run({ command: "git", arguments: ["init"], directory: repo });
  trackEverything({ repo });
  const modules = checkModulesOn({ line: request.line });
  await runCommandIn({ repo, subcommand: "project", options: [], modules });
  trackEverything({ repo });
  return repo;
};

describe.each(ESLINT_LINES)("hone upgrade over a real repository whose ESLint slices are not only at the root, on %s", (line) => {
  it("carries a package slice to version 2, rewrites the package config to import it, and leaves a repository that checks the same", async () => {
    const modules = checkModulesOn({ line });
    const repo = await packageRepository({
      line,
      files: { "disciplines.json": PACKAGE_SELECTION, "discipline-exceptions.json": PACKAGE_CARVE_OUT, "eslint.config.mjs": TEAM_CONFIG },
      packageFiles: { "kept.ts": KEPT_CLASS, "eslint.config.mjs": PACKAGE_CONFIG },
    });
    const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules });
    trackEverything({ repo });
    const checked = await runCommandIn({ repo, subcommand: "check", options: ["--forfeiture", "elsewhere"], modules });
    const again = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules });
    expect({ upgraded, checked, again, after: listedPathsOf({ repo }) }).toEqual({
      upgraded: {
        writes: [
          [
            {
              text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nwrote packages/a/hone.eslint.mjs\nrewrote eslint.config.mjs\nrewrote packages/a/eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved packages/a/disciplines.eslint.mjs\nremoved disciplines.json\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      checked: {
        writes: [
          [
            {
              text: "answered (1)\nauthored-class-or-this#class-keyword eslint packages/a/kept.ts:1:7 export class Kept {} answered by debt\nassessment (1)\nforfeiture elsewhere: 1 debt record not checked for forfeiture in this run\nverdict: pass (partial assessment)\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      again: { writes: [[{ text: "already on version 2; nothing to upgrade\n" }]], exits: [[{ code: 0 }]] },
      after: [
        "eslint.config.mjs",
        "hone-records/",
        "hone-records/debt/",
        "hone-records/debt/authored-class-or-this.json",
        "hone.config.json",
        "hone.eslint.mjs",
        "packages/",
        "packages/a/",
        "packages/a/eslint.config.mjs",
        "packages/a/hone.eslint.mjs",
        "packages/a/kept.ts",
      ],
    });
  });

  it("carries a declared eslintConfigRoots folder under the repository-root lookup, and checks it with the same findings answered", async () => {
    const modules = checkModulesOn({ line });
    const repo = await packageRepository({
      line,
      files: { "disciplines.json": DECLARED_SELECTION, "discipline-exceptions.json": ROOT_CARVE_OUT, "kept.ts": KEPT_CLASS, "eslint.config.mjs": ROOT_CONFIG_IMPORTING_PACKAGE_SLICE },
      packageFiles: { "kept.ts": PACKAGE_SOURCE, "eslint.config.mjs": UNPROJECTING_PACKAGE_CONFIG },
    });
    const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules });
    trackEverything({ repo });
    const checked = await runCommandIn({ repo, subcommand: "check", options: ["--forfeiture", "elsewhere"], modules });
    const configuration = fileText.read({ path: `${repo}/hone.config.json` });
    expect({ upgraded, checked, configuration, after: listedPathsOf({ repo }) }).toEqual({
      upgraded: {
        writes: [[{ text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nwrote packages/a/hone.eslint.mjs\nrewrote eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved packages/a/disciplines.eslint.mjs\nremoved disciplines.json\n" }]],
        exits: [[{ code: 0 }]],
      },
      checked: {
        writes: [[{ text: "answered (1)\nauthored-class-or-this#class-keyword eslint kept.ts:1:7 export class Kept {} answered by debt\nassessment (1)\nforfeiture elsewhere: 1 debt record not checked for forfeiture in this run\nverdict: pass (partial assessment)\n" }]],
        exits: [[{ code: 0 }]],
      },
      configuration: {
        outcome: "ok",
        value:
          '{\n  "version": 2,\n  "ruleSets": {},\n  "checks": {\n    "authored-class-or-this#class-keyword": "eslint",\n    "authored-class-or-this#static-members-only": "eslint"\n  },\n  "eslintConfigRoots": [\n    "packages/a"\n  ],\n  "eslintConfigLookup": "repository-root"\n}\n',
      },
      after: [
        "eslint.config.mjs",
        "hone-records/",
        "hone-records/debt/",
        "hone-records/debt/authored-class-or-this.json",
        "hone.config.json",
        "hone.eslint.mjs",
        "kept.ts",
        "packages/",
        "packages/a/",
        "packages/a/eslint.config.mjs",
        "packages/a/hone.eslint.mjs",
        "packages/a/kept.ts",
      ],
    });
  });

  it("refuses a package config that never imports its slice, and leaves every file of the repository byte for byte as it was", async () => {
    const modules = checkModulesOn({ line });
    const repo = await packageRepository({
      line,
      files: { "disciplines.json": PACKAGE_SELECTION, "discipline-exceptions.json": PACKAGE_CARVE_OUT, "eslint.config.mjs": TEAM_CONFIG },
      packageFiles: { "kept.ts": KEPT_CLASS, "eslint.config.mjs": UNPROJECTING_PACKAGE_CONFIG },
    });
    const before = treeOf({ repo });
    const refused = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules });
    expect({ refused, after: treeOf({ repo }) }).toEqual({
      refused: {
        writes: [
          [
            {
              text: "upgrade refused:\nthe version 1 projection packages/a/disciplines.eslint.mjs is not-applied. Run hone check with your version 1 release, fix what it reports, then run the upgrade again.\nNothing was changed.\n",
            },
          ],
        ],
        exits: [[{ code: 1 }]],
      },
      after: before,
    });
  });
});
