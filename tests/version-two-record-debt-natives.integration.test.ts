import { afterAll, assert, describe, expect, it } from "vitest";
import { pruneCommandOf } from "../core/command-line/tool-invocations.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort } from "../scripts/install-proof-ports.ts";
import { repositoryRootOf } from "./allowed-forms-proof.ts";
import { scratchRepositoriesUnder } from "./scratch-repositories.ts";
import { repositoryWithSubfolder } from "./subfolder-scratch-repository.ts";
import { settingsTextOf } from "./version-two-files.ts";

const INSTALL_ROOT = absolutePathSchema.parse(repositoryRootOf({ testFolder: import.meta.dirname }));

const TOOL_COMMAND_FILE = `${INSTALL_ROOT}/core/check/tool-command.ts`;

const EACH_STEP_IS_A_PROCESS_MILLISECONDS = 120_000;

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText, scratch });

afterAll(() => {
  repositories.removeAll();
});

const commands = createDefaultCommandRunPort({});

const CONFIG = settingsTextOf({
  checks: {
    "authored-class-or-this#class-keyword": "eslint",
    "authored-class-or-this#static-members-only": "not-adopted",
    "claimed-type#cast-to-any": "not-adopted",
    "claimed-type#unlisted-cast-site": "walker",
    "claimed-type#non-null-assertions": "not-adopted",
  },
  exclude: [],
});

const ESLINT_CONFIG = `import hone from "./hone.eslint.mjs";
export default [...hone];
`;

const CLASS_SOURCE = "export class Kept {}\n";

const INLINE_DISABLE_SOURCE = "// eslint-disable-next-line hone/authored-class-or-this/class-keyword\nexport const inherited = 1;\n";

const TYPE_DIRECTIVE_SOURCE = '// @ts-expect-error\nexport const wrong: number = "a";\n';

const FIXED_CLASS_SOURCE = "export const kept = 1;\n";

const FIXED_DISABLE_SOURCE = "export const inherited = 1;\n";

const FIXED_DIRECTIVE_SOURCE = "export const wrong = 1;\n";

const GIT_IDENTITY = ["-c", "user.name=adopter", "-c", "user.email=adopter@example.test", "-c", "commit.gpgsign=false"];

type Printed = { readonly text: string; readonly code: number };

const git = (request: { readonly repo: string; readonly arguments: readonly string[] }): void => {
  const run = commands.run({ command: "git", arguments: [...GIT_IDENTITY, ...request.arguments], directory: request.repo });
  assert(run.outcome === "exited", "a git step in the scratch repository ran to an exit");
  assert(run.exitCode === 0, "a git step in the scratch repository succeeded");
};

const toolIn = (request: { readonly repo: string; readonly subcommand: string; readonly options: readonly string[] }): Printed => {
  const run = commands.run({
    command: "node",
    arguments: [TOOL_COMMAND_FILE, request.subcommand, "--repo", request.repo, ...request.options],
    directory: request.repo,
  });
  assert(run.outcome === "exited", "the tool command ran to an exit");
  return { text: run.output, code: run.exitCode };
};

const trackEverything = (request: { readonly repo: string }): void => {
  git({ repo: request.repo, arguments: ["add", "."] });
};

const commitEverything = (request: { readonly repo: string }): void => {
  trackEverything(request);
  git({ repo: request.repo, arguments: ["commit", "-q", "-m", "commit"] });
};

const writeIn = (request: { readonly repo: string; readonly file: string; readonly text: string }): void => {
  const written = fileText.write({ path: `${request.repo}/${request.file}`, text: request.text });
  assert(written.outcome === "ok", "the scratch file is written");
};

const inheritingRepository = (): string => {
  const repo = repositoryWithSubfolder({
    repositories,
    scratch,
    fileText,
    files: { "hone.config.json": CONFIG, "eslint.config.mjs": ESLINT_CONFIG },
    subfolder: "src",
    subfolderFiles: { "kept.ts": CLASS_SOURCE, "disabled.ts": INLINE_DISABLE_SOURCE, "directive.ts": TYPE_DIRECTIVE_SOURCE },
  });
  git({ repo, arguments: ["init", "-q"] });
  trackEverything({ repo });
  return repo;
};

const FORFEITURE_ELSEWHERE = ["--forfeiture", "elsewhere"];

const PATH = createDefaultPathPort({});

const ENTRY_URL = new URL("../core/check/tool-command.ts", import.meta.url).href;

const pruneCommandIn = (request: { readonly repo: string }): string => {
  const command = pruneCommandOf({ path: PATH, moduleUrl: ENTRY_URL, repoRoot: absolutePathSchema.parse(request.repo), baseRevision: undefined, forfeiture: "elsewhere" });
  assert(command.outcome === "ok", "the prune command is made");
  return command.value;
};

const NOT_ADOPTED = "notAdopted (3)\nauthored-class-or-this#static-members-only\nclaimed-type#cast-to-any\nclaimed-type#non-null-assertions\n";

const CLASS_SYMPTOM =
  "authored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. Known debt: debt. Read ../../rules/typescript/symptoms.md#authored-class-or-this\n";

const INHERITED_TEXT = `${NOT_ADOPTED}findings (1)
authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
unrecorded (2)
authored-class-or-this#class-keyword eslint inline-disable src/disabled.ts:1 // eslint-disable-next-line hone/authored-class-or-this/class-keyword
claimed-type#unlisted-cast-site walker inline-disable src/directive.ts:1 // @ts-expect-error
assessment (1)
forfeiture elsewhere: 0 debt records not checked for forfeiture in this run
symptoms (1)
${CLASS_SYMPTOM}verdict: fail (partial assessment)
`;

const RECORDED_TEXT = `claimed-type#unlisted-cast-site recorded src/directive.ts
authored-class-or-this#class-keyword recorded src/disabled.ts
authored-class-or-this#class-keyword recorded src/kept.ts
`;

const ADOPTED_TEXT = `${NOT_ADOPTED}answered (1)
authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} answered by debt
verdict: pass
`;

const stale = (request: { readonly repo: string; readonly check: string; readonly file: string }): string =>
  `${request.check} debt ${request.file}; nothing it holds is found: run ${pruneCommandIn({ repo: request.repo })} to remove it\n`;

const paidText = (request: { readonly repo: string }): string =>
  `${NOT_ADOPTED}stale (3)
${stale({ repo: request.repo, check: "authored-class-or-this#class-keyword", file: "src/disabled.ts" })}${stale({ repo: request.repo, check: "authored-class-or-this#class-keyword", file: "src/kept.ts" })}${stale({ repo: request.repo, check: "claimed-type#unlisted-cast-site", file: "src/directive.ts" })}assessment (1)
forfeiture elsewhere: 3 debt records not checked for forfeiture in this run
verdict: fail (partial assessment)
`;

const PRUNED_TEXT = `authored-class-or-this#class-keyword removed src/disabled.ts: stale
authored-class-or-this#class-keyword removed src/kept.ts: stale
claimed-type#unlisted-cast-site removed src/directive.ts: stale
`;

describe("hone record-debt over a repository that inherits a finding, an inline disable and a TypeScript directive, run as the real tool command", () => {
  it(
    "goes red, records the debt each needs, and goes green with a base revision once projected; paying it makes the debt prunable",
    () => {
      const repo = inheritingRepository();
      toolIn({ repo, subcommand: "project", options: [] });
      commitEverything({ repo });
      const inherited = toolIn({ repo, subcommand: "check", options: FORFEITURE_ELSEWHERE });
      const recorded = toolIn({ repo, subcommand: "record-debt", options: ["--base-revision", "HEAD"] });
      const projected = toolIn({ repo, subcommand: "project", options: [] });
      trackEverything({ repo });
      const adopted = toolIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"] });
      commitEverything({ repo });
      writeIn({ repo, file: "src/kept.ts", text: FIXED_CLASS_SOURCE });
      writeIn({ repo, file: "src/disabled.ts", text: FIXED_DISABLE_SOURCE });
      writeIn({ repo, file: "src/directive.ts", text: FIXED_DIRECTIVE_SOURCE });
      trackEverything({ repo });
      const paid = toolIn({ repo, subcommand: "check", options: FORFEITURE_ELSEWHERE });
      const pruned = toolIn({ repo, subcommand: "prune-debt", options: FORFEITURE_ELSEWHERE });
      expect({ inherited, recorded, projected, adopted, paid, pruned }).toEqual({
        inherited: { text: INHERITED_TEXT, code: 1 },
        recorded: { text: RECORDED_TEXT, code: 0 },
        projected: { text: "hone.eslint.mjs written\nhone.eslint.d.mts unchanged\n", code: 0 },
        adopted: { text: ADOPTED_TEXT, code: 0 },
        paid: { text: paidText({ repo }), code: 1 },
        pruned: { text: PRUNED_TEXT, code: 0 },
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});
