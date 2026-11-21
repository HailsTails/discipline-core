import { afterAll, assert, describe, expect, it, vi } from "vitest";
import type { Subcommand } from "../core/command-line/command-line.ts";
import { TOOL_SUBCOMMANDS } from "../core/check/run-tool-command.ts";
import type { ExceptionRepositoryOf } from "../core/upgrade/version-one-records/exception-records.ts";
import { projectCommandOf, pruneCommandOf } from "../core/command-line/tool-invocations.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultGitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort } from "../scripts/install-proof-ports.ts";
import { repositoryRootOf } from "./allowed-forms-proof.ts";
import { CAUSAL_WHY_CHAIN } from "./causal-why-chain.ts";
import { scratchRepositoriesUnder } from "./scratch-repositories.ts";
import { repositoryWithSubfolder } from "./subfolder-scratch-repository.ts";

const INSTALL_ROOT = absolutePathSchema.parse(repositoryRootOf({ testFolder: import.meta.dirname }));

const ENTRY_URL = new URL("../core/check/tool-command.ts", import.meta.url).href;

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText, scratch });

afterAll(() => {
  repositories.removeAll();
});

const commands = createDefaultCommandRunPort({});

const configOf = (request: { readonly exclude: string; readonly castEngine: string; readonly unlistedCastSite: string }): string => `{
  "version": 2,
  "exclude": [${request.exclude}],
  "ruleSets": {},
  "checks": {
    "authored-class-or-this#class-keyword": "eslint",
    "authored-class-or-this#static-members-only": "not-adopted",
    "claimed-type#cast-to-any": "${request.castEngine}",
${request.unlistedCastSite}    "claimed-type#non-null-assertions": "not-adopted"
  },
  "checkSettings": {},
  "conventions": {},
  "layers": {}
}
`;

const UNLISTED_CAST_SITE_NOT_ADOPTED = '    "claimed-type#unlisted-cast-site": "not-adopted",\n';

const CONFIG = configOf({ exclude: "", castEngine: "walker", unlistedCastSite: UNLISTED_CAST_SITE_NOT_ADOPTED });

const ESLINT_CONFIG = `import hone from "./hone.eslint.mjs";
export default [...hone];
`;

const CLASS_SOURCE = "export class Kept {}\n";

const FIXED_CLASS_SOURCE = "export const kept = 1;\n";

const CAST_SOURCE = "export const parsed = JSON.parse(text) as any;\n";

const SECOND_CAST_SOURCE = "export const added = JSON.parse(text) as any;\n";

const TOUCHED_CAST_SOURCE = "export const parsed = JSON.parse(raw) as any;\n";

const AUTHORISE_OPTIONS = [
  "--symptom",
  "claimed-type",
  "--file",
  "src/cast.ts",
  "--case",
  "gives-a-value-its-type",
  "--owes",
  "declared-not-asserted",
  "--why",
  "Why does the audit refuse tracker ids in carve-out names?",
  "--because",
  "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
  "--evidence",
  "tools/audit/name-matcher.ts:14",
  "--why",
  "Why does the name matcher accept only lowercase slugs?",
  "--because",
  "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
  "--evidence",
  "tools/git/branch-name.ts:8",
  "--why",
  "Why was the matcher copied from the branch-name validator?",
  "--because",
  "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
  "--evidence",
  "PR #212, merged 2026-07-02",
  "--why",
  "Why did no shared slug type exist when the audit landed?",
  "--because",
  "The values package that now holds RepoPath was split out two months after the audit.",
  "--evidence",
  "packages/values/package.json:3",
  "--why",
  "Why was the values package split out after the audit?",
  "--because",
  "The split waited on the monorepo move, which left older tools on their own patterns.",
  "--evidence",
  "docs/decisions/0007-monorepo.md:21",
  "--root-cause",
  CAUSAL_WHY_CHAIN.rootCause,
  "--root-check",
  CAUSAL_WHY_CHAIN.rootCheck,
  "--readback",
  CAUSAL_WHY_CHAIN.readback,
  "--owner",
  CAUSAL_WHY_CHAIN.owner,
];

const NOT_ADOPTED = "notAdopted (3)\nauthored-class-or-this#static-members-only\nclaimed-type#unlisted-cast-site\nclaimed-type#non-null-assertions\n";

const CLASS_FINDING =
  "authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted\n";

const MAY_INDICATE = "may indicate: declared-not-asserted, straight-through-tests, handed-what-it-uses";

const cast = (request: { readonly file: string; readonly column: number; readonly source: string; readonly ending: string }): string =>
  `claimed-type#cast-to-any walker ${request.file}:1:${request.column} ${request.source}  ${request.ending}\n`;

const CAST_FINDING = cast({ file: "src/cast.ts", column: 22, source: "JSON.parse(text) as any;", ending: MAY_INDICATE });

const CAST_ANSWERED_BY_DEBT = cast({ file: "src/cast.ts", column: 22, source: "JSON.parse(text) as any;", ending: "answered by debt" });

const CAST_ANSWERED_BY_LOCATION = cast({ file: "src/cast.ts", column: 22, source: "JSON.parse(text) as any;", ending: "answered by authorised-location" });

const TOUCHED_CAST_FINDING = cast({ file: "src/cast.ts", column: 22, source: "JSON.parse(raw) as any;", ending: MAY_INDICATE });

const SECOND_CAST_FINDING = cast({ file: "src/added.ts", column: 21, source: "JSON.parse(text) as any;", ending: MAY_INDICATE });

const GENERATED_CAST_FINDING = cast({ file: "src/generated/gen.ts", column: 22, source: "JSON.parse(text) as any;", ending: MAY_INDICATE });

const CLASS_SYMPTOM =
  "authored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. Known debt: debt. Read ../../rules/typescript/symptoms.md#authored-class-or-this\n";

const CAST_SYMPTOM =
  "claimed-type: Claimed type. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; checks a value that may be one of several outcomes → Straight-through tests; gives a value its type (declares it, or needs it narrower): in a test, a cast to build an input → Handed what it uses. The breach usually sits in the declaration: an input too wide, a generic not bounded, a missing parse. Recipes: Fix the declaration, not the value; Assert to narrow; One argument object. Correct use: an authorised location in the adapter whose outside contract forces it. Known debt: debt. Read ../../rules/typescript/symptoms.md#claimed-type\n";

type Printed = { readonly writes: readonly [readonly [{ readonly text: string }]]; readonly exits: readonly [readonly [{ readonly code: number }]] };

const printed = (request: { readonly text: string; readonly code: number }): Printed => ({
  writes: [[{ text: request.text }]],
  exits: [[{ code: request.code }]],
});

const PATH = createDefaultPathPort({});

const projectCommandIn = (request: { readonly repo: string }): string => {
  const command = projectCommandOf({ path: PATH, moduleUrl: ENTRY_URL, repoRoot: absolutePathSchema.parse(request.repo) });
  assert(command.outcome === "ok", "the project command is made");
  return command.value;
};

const pruneCommandAtHeadIn = (request: { readonly repo: string }): string => {
  const command = pruneCommandOf({ path: PATH, moduleUrl: ENTRY_URL, repoRoot: absolutePathSchema.parse(request.repo), baseRevision: "HEAD", forfeiture: undefined });
  assert(command.outcome === "ok", "the prune command is made");
  return command.value;
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
    exceptionRepositoryOf: vi.fn<ExceptionRepositoryOf>(),
    moduleUrl: ENTRY_URL,
  });
  return { writes: vi.mocked(processPort.writeOut).mock.calls, exits: vi.mocked(processPort.exitWith).mock.calls };
};

const git = (request: { readonly repo: string; readonly arguments: readonly string[] }): void => {
  commands.run({ command: "git", arguments: request.arguments, directory: request.repo });
};

const trackEverything = (request: { readonly repo: string }): void => {
  git({ repo: request.repo, arguments: ["add", "."] });
};

const commitEverything = (request: { readonly repo: string }): void => {
  trackEverything(request);
  git({ repo: request.repo, arguments: ["-c", "user.name=adopter", "-c", "user.email=adopter@example.test", "commit", "-m", "commit"] });
};

const writeIn = (request: { readonly repo: string; readonly file: string; readonly text: string }): void => {
  fileText.write({ path: `${request.repo}/${request.file}`, text: request.text });
};

const adopterRepository = (request: { readonly sources: Readonly<Record<string, string>> }): string => {
  const repo = repositoryWithSubfolder({
    repositories,
    scratch,
    fileText,
    files: { "hone.config.json": CONFIG, "eslint.config.mjs": ESLINT_CONFIG },
    subfolder: "src",
    subfolderFiles: request.sources,
  });
  git({ repo, arguments: ["init"] });
  trackEverything({ repo });
  return repo;
};

const adopterRepositoryWithGeneratedFolder = (): string => {
  const repo = adopterRepository({ sources: { "clean.ts": "export const clean = 1;\n" } });
  scratch.makeDirectory({ path: `${repo}/src/generated` });
  writeIn({ repo, file: "src/generated/gen.ts", text: CAST_SOURCE });
  trackEverything({ repo });
  return repo;
};

const PROJECTION_WRITTEN = printed({ text: "hone.eslint.mjs written\n", code: 0 });

const PROJECTION_UNCHANGED = printed({ text: "hone.eslint.mjs unchanged\n", code: 0 });

const DEBT_RECORDED = printed({
  text: "claimed-type#cast-to-any recorded src/cast.ts\nauthored-class-or-this#class-keyword left src/kept.ts: under --leave src/kept.ts; record it as an authorised location with its own reason, or fix it\n",
  code: 0,
});

describe("a version 2 adopter's repository, from the first project to a clean check, through the real ports", () => {
  it("projects, finds each violation, answers one by debt, replaces that debt with an authorised location, prunes what that paid, and passes once the other is fixed", async () => {
    const repo = adopterRepository({ sources: { "kept.ts": CLASS_SOURCE, "cast.ts": CAST_SOURCE } });
    const projected = await runCommandIn({ repo, subcommand: "project", options: [] });
    const projectedAgain = await runCommandIn({ repo, subcommand: "project", options: [] });
    const checked = await runCommandIn({ repo, subcommand: "check", options: [] });
    commitEverything({ repo });
    const recorded = await runCommandIn({ repo, subcommand: "record-debt", options: ["--base-revision", "HEAD", "--leave", "src/kept.ts"] });
    trackEverything({ repo });
    const answeredByDebt = await runCommandIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"] });
    const authorised = await runCommandIn({ repo, subcommand: "authorise", options: AUTHORISE_OPTIONS });
    trackEverything({ repo });
    const answeredByLocation = await runCommandIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"] });
    const pruned = await runCommandIn({ repo, subcommand: "prune-debt", options: ["--base-revision", "HEAD"] });
    writeIn({ repo, file: "src/kept.ts", text: FIXED_CLASS_SOURCE });
    trackEverything({ repo });
    const clean = await runCommandIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"] });
    expect({ projected, projectedAgain, checked, recorded, answeredByDebt, authorised, answeredByLocation, pruned, clean }).toEqual({
      projected: PROJECTION_WRITTEN,
      projectedAgain: PROJECTION_UNCHANGED,
      checked: printed({ text: `${NOT_ADOPTED}findings (2)\n${CLASS_FINDING}${CAST_FINDING}symptoms (2)\n${CLASS_SYMPTOM}${CAST_SYMPTOM}verdict: fail\n`, code: 1 }),
      recorded: DEBT_RECORDED,
      answeredByDebt: printed({
        text: `${NOT_ADOPTED}findings (1)\n${CLASS_FINDING}answered (1)\n${CAST_ANSWERED_BY_DEBT}symptoms (1)\n${CLASS_SYMPTOM}verdict: fail\n`,
        code: 1,
      }),
      authorised: printed({ text: "claimed-type authorised src/cast.ts\n", code: 0 }),
      answeredByLocation: printed({
        text: `${NOT_ADOPTED}findings (1)\n${CLASS_FINDING}answered (1)\n${CAST_ANSWERED_BY_LOCATION}paid (1)\nclaimed-type#cast-to-any debt src/cast.ts answered by authorised-location; run ${pruneCommandAtHeadIn({ repo })} to remove the paid debt\nsymptoms (1)\n${CLASS_SYMPTOM}verdict: fail\n`,
        code: 1,
      }),
      pruned: printed({ text: "claimed-type#cast-to-any removed src/cast.ts: paid\n", code: 0 }),
      clean: printed({ text: `${NOT_ADOPTED}answered (1)\n${CAST_ANSWERED_BY_LOCATION}verdict: pass\n`, code: 0 }),
    });
  });
});

const FORFEITURE_UNMEASURED =
  'unmeasured (1)\nforfeiture-unmeasured no-base-revision: no --base-revision was given, so debt cannot be checked for forfeiture; pass --base-revision with the branch\'s base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere\n';

const forfeitedLine = (request: { readonly repo: string }): string =>
  `forfeited (1)\nclaimed-type#cast-to-any debt src/cast.ts; this change touched its file, so it no longer answers: fix what it held, then run ${pruneCommandAtHeadIn({ repo: request.repo })} to remove it\n`;

describe("a version 2 adopter's repository judged against a base revision, through the real ports", () => {
  it("cannot judge debt with no base, passes with the base when nothing changed, reports a new violation, and forfeits debt on a file the change touched", async () => {
    const repo = adopterRepository({ sources: { "kept.ts": FIXED_CLASS_SOURCE, "cast.ts": CAST_SOURCE } });
    await runCommandIn({ repo, subcommand: "project", options: [] });
    commitEverything({ repo });
    const recorded = await runCommandIn({ repo, subcommand: "record-debt", options: ["--base-revision", "HEAD"] });
    commitEverything({ repo });
    const withoutBase = await runCommandIn({ repo, subcommand: "check", options: [] });
    const unchanged = await runCommandIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"] });
    writeIn({ repo, file: "src/added.ts", text: SECOND_CAST_SOURCE });
    trackEverything({ repo });
    const added = await runCommandIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"] });
    writeIn({ repo, file: "src/cast.ts", text: TOUCHED_CAST_SOURCE });
    const touched = await runCommandIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"] });
    expect({ recorded, withoutBase, unchanged, added, touched }).toEqual({
      recorded: printed({ text: "claimed-type#cast-to-any recorded src/cast.ts\n", code: 0 }),
      withoutBase: printed({ text: `${NOT_ADOPTED}answered (1)\n${CAST_ANSWERED_BY_DEBT}${FORFEITURE_UNMEASURED}verdict: fail\n`, code: 1 }),
      unchanged: printed({ text: `${NOT_ADOPTED}answered (1)\n${CAST_ANSWERED_BY_DEBT}verdict: pass\n`, code: 0 }),
      added: printed({ text: `${NOT_ADOPTED}findings (1)\n${SECOND_CAST_FINDING}answered (1)\n${CAST_ANSWERED_BY_DEBT}symptoms (1)\n${CAST_SYMPTOM}verdict: fail\n`, code: 1 }),
      touched: printed({
        text: `${NOT_ADOPTED}findings (2)\n${SECOND_CAST_FINDING}${TOUCHED_CAST_FINDING}${forfeitedLine({ repo })}symptoms (1)\n${CAST_SYMPTOM}verdict: fail\n`,
        code: 1,
      }),
    });
  });
});

const CONFIG_EXCLUDING_GENERATED = configOf({ exclude: '"src/generated"', castEngine: "walker", unlistedCastSite: UNLISTED_CAST_SITE_NOT_ADOPTED });

const CONFIG_WITH_UNKNOWN_ENGINE = configOf({ exclude: "", castEngine: "nope", unlistedCastSite: UNLISTED_CAST_SITE_NOT_ADOPTED });

const CONFIG_LEAVING_A_CHECK_UNLISTED = configOf({ exclude: "", castEngine: "walker", unlistedCastSite: "" });

const NOT_ADOPTED_WITHOUT_THE_UNLISTED_CAST_SITE = "notAdopted (2)\nauthored-class-or-this#static-members-only\nclaimed-type#non-null-assertions\n";

const FILES_THE_EMPTIED_PROJECTION_LEAVES_UNCONFIGURED =
  "unrecorded (2)\nauthored-class-or-this#class-keyword eslint ignore src/clean.ts\nauthored-class-or-this#class-keyword eslint ignore src/generated/gen.ts\n";

const projectionProblem = (request: { readonly repo: string }): string =>
  `${FILES_THE_EMPTIED_PROJECTION_LEAVES_UNCONFIGURED}projectionProblems (1)\neslint out-of-date: hone.eslint.mjs differs from what hone project writes now; run ${projectCommandIn({ repo: request.repo })} and commit every hone.eslint.mjs it writes\n`;

const projectionMissing = (request: { readonly repo: string }): string =>
  `unmeasured (1)\nengine-not-run eslint missing: hone.eslint.mjs is not written; run ${projectCommandIn({ repo: request.repo })} and commit every hone.eslint.mjs it writes\n`;

describe("the settings a version 2 adopter edits, through the real ports", () => {
  it("drops an excluded folder from the check, and prints the folder as excluded", async () => {
    const repo = adopterRepositoryWithGeneratedFolder();
    await runCommandIn({ repo, subcommand: "project", options: [] });
    const before = await runCommandIn({ repo, subcommand: "check", options: [] });
    writeIn({ repo, file: "hone.config.json", text: CONFIG_EXCLUDING_GENERATED });
    const after = await runCommandIn({ repo, subcommand: "check", options: [] });
    expect({ before, after }).toEqual({
      before: printed({ text: `${NOT_ADOPTED}findings (1)\n${GENERATED_CAST_FINDING}symptoms (1)\n${CAST_SYMPTOM}verdict: fail\n`, code: 1 }),
      after: printed({ text: `excluded (1)\nsrc/generated\n${NOT_ADOPTED}verdict: pass\n`, code: 0 }),
    });
  });

  it("refuses an engine a check does not run on, naming the check, and exits 2 with no verdict", async () => {
    const repo = adopterRepositoryWithGeneratedFolder();
    writeIn({ repo, file: "hone.config.json", text: CONFIG_WITH_UNKNOWN_ENGINE });
    expect(await runCommandIn({ repo, subcommand: "check", options: [] })).toEqual(
      printed({ text: "load failure: engine-not-allowed claimed-type#cast-to-any nope: it runs on walker; list it with one of those\n", code: 2 }),
    );
  });

  it("fails on a check of a selected symptom that is neither listed nor marked not-adopted", async () => {
    const repo = adopterRepositoryWithGeneratedFolder();
    await runCommandIn({ repo, subcommand: "project", options: [] });
    writeIn({ repo, file: "hone.config.json", text: CONFIG_LEAVING_A_CHECK_UNLISTED });
    expect(await runCommandIn({ repo, subcommand: "check", options: [] })).toEqual(
      printed({
        text: `${NOT_ADOPTED_WITHOUT_THE_UNLISTED_CAST_SITE}findings (1)\n${GENERATED_CAST_FINDING}uncovered (1)\nclaimed-type#unlisted-cast-site\nsymptoms (1)\n${CAST_SYMPTOM}verdict: fail\n`,
        code: 1,
      }),
    );
  });

  it("says a projection that differs from what project writes is out of date, and one that is not written is missing, each with the command that fixes it", async () => {
    const repo = adopterRepositoryWithGeneratedFolder();
    await runCommandIn({ repo, subcommand: "project", options: [] });
    writeIn({ repo, file: "hone.eslint.mjs", text: "export default [];\n" });
    const outOfDate = await runCommandIn({ repo, subcommand: "check", options: [] });
    scratch.removeTree({ path: `${repo}/hone.eslint.mjs` });
    const missing = await runCommandIn({ repo, subcommand: "check", options: [] });
    expect({ outOfDate, missing }).toEqual({
      outOfDate: printed({ text: `${NOT_ADOPTED}findings (1)\n${GENERATED_CAST_FINDING}${projectionProblem({ repo })}symptoms (1)\n${CAST_SYMPTOM}verdict: fail\n`, code: 1 }),
      missing: printed({ text: `${NOT_ADOPTED}findings (1)\n${GENERATED_CAST_FINDING}${projectionMissing({ repo })}symptoms (1)\n${CAST_SYMPTOM}verdict: fail\n`, code: 1 }),
    });
  });
});
