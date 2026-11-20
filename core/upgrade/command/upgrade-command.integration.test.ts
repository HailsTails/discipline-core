import { afterAll, assert, describe, expect, it, vi } from "vitest";
import { createDefaultDirectoryPort } from "../../platform-ports/file-system-port.ts";
import { TOOL_SUBCOMMANDS } from "../../check/run-tool-command.ts";
import { createDefaultExceptionRepositoryOf } from "../../exception-records/exception-layout.ts";
import type { Subcommand } from "../../command-line/command-line.ts";
import { createDefaultFileTextPort } from "../../platform-ports/file-text-port.ts";
import { createDefaultGitPort } from "../../platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../../platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../../platform-ports/path-port.ts";
import type { ProcessPort } from "../../platform-ports/process-port.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort } from "../../../scripts/install-proof-ports.ts";
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
    exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
    moduleUrl: ENTRY_URL,
  });
  return { writes: vi.mocked(processPort.writeOut).mock.calls, exits: vi.mocked(processPort.exitWith).mock.calls };
};

const trackEverything = (request: { readonly repo: string }): void => {
  commands.run({ command: "git", arguments: ["add", "."], directory: request.repo });
};

const KEPT_CLASS = "export class Kept {}\n";

const versionOneRepository = async (request: { readonly source: string }): Promise<string> => {
  const repo = repositoryWithSubfolder({
    repositories,
    scratch,
    fileText,
    files: VERSION_ONE_FILES,
    subfolder: "src",
    subfolderFiles: { "kept.ts": request.source },
  });
  commands.run({ command: "git", arguments: ["init"], directory: repo });
  trackEverything({ repo });
  await runCommandIn({ repo, subcommand: "project", options: [] });
  trackEverything({ repo });
  return repo;
};

const commitEverything = (request: { readonly repo: string }): void => {
  commands.run({ command: "git", arguments: ["-c", "user.name=proof", "-c", "user.email=proof@example.test", "commit", "-m", "base"], directory: request.repo });
};

const directory = createDefaultDirectoryPort({});

const GIT_FOLDER = ".git";

const pathsUnder = (request: { readonly folder: string; readonly prefix: string }): readonly string[] => {
  const listed = directory.list({ path: absolutePathSchema.parse(request.folder) });
  assert(listed.outcome === "ok", `${request.folder} lists`);
  return listed.value
    .filter(({ name }) => name !== GIT_FOLDER)
    .flatMap(({ name, kind }) => {
      const shown = `${request.prefix}${name}`;
      return kind === "directory" ? [`${shown}/`, ...pathsUnder({ folder: `${request.folder}/${name}`, prefix: `${shown}/` })] : [shown];
    });
};

const treeOf = (request: { readonly repo: string }): Readonly<Record<string, string>> =>
  Object.fromEntries(
    pathsUnder({ folder: request.repo, prefix: "" })
      .toSorted()
      .map((shown) => {
        const read = shown.endsWith("/") ? undefined : fileText.read({ path: `${request.repo}/${shown}` });
        return [shown, read === undefined ? "<folder>" : read.outcome === "ok" ? read.value : "<unreadable>"];
      }),
  );

describe("hone upgrade over a real repository, through the real ports", () => {
  it("upgrades a version 1 repository, checks it with the projection current, and finds nothing left to upgrade", async () => {
    const repo = await versionOneRepository({ source: KEPT_CLASS });
    const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [] });
    trackEverything({ repo });
    const checked = await runCommandIn({ repo, subcommand: "check", options: ["--forfeiture", "elsewhere"] });
    const again = await runCommandIn({ repo, subcommand: "upgrade", options: [] });
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
    const repo = await versionOneRepository({ source: "export const kept = 1;\n" });
    const before = treeOf({ repo });
    const refused = await runCommandIn({ repo, subcommand: "upgrade", options: [] });
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
    const repo = await versionOneRepository({ source: KEPT_CLASS });
    await runCommandIn({ repo, subcommand: "split-records", options: [] });
    trackEverything({ repo });
    commitEverything({ repo });
    const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [] });
    trackEverything({ repo });
    const checked = await runCommandIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"] });
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
});
