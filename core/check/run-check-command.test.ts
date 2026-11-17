import { describe, expect, it, vi } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../tests/causal-why-chain.ts";
import { requiredEntry } from "../../tests/required-entry.ts";
import type { LoadedRunner } from "../mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import { reportOutputSchema } from "../values/report-output.ts";
import { type CommandRequest, runCheckCommand } from "./run-check-command.ts";

const ENTRY_URL = "file:///install/core/check/tool-command.ts";

type FakeFile = {
  readonly read: ReturnType<FileTextPort["read"]>;
  readonly presence: ReturnType<FileTextPort["exists"]>;
};

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } },
  presence: "absent",
};

const CLASS_SYNTAX_DEFINITION = {
  kind: "mechanical",
  id: "class-syntax",
  summary: "no class syntax",
  mechanisms: ["audit"],
  anchor: { kind: "keyword", keyword: "class" },
  cases: {
    flag: [{ name: "flagged", fileName: "src/a.ts", source: "class A {}\n", expectedLines: [1] }],
    allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
  },
};

const NOTHING_SELECTED: Readonly<Record<string, FakeFile>> = {
  "/repo/disciplines.json": presentFile({ text: JSON.stringify({ version: 1, ruleSets: {}, clauses: {} }) }),
  "/repo/discipline-exceptions.json": ABSENT_FILE,
};

const classSyntaxSelectedWith = (settings: Readonly<Record<string, unknown>>): Readonly<Record<string, FakeFile>> => ({
  "/repo/disciplines.json": presentFile({
    text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "audit" }, ...settings }),
  }),
  "/repo/discipline-exceptions.json": ABSENT_FILE,
  "/install/rules/CD-14/discipline.json": presentFile({
    text: JSON.stringify({ version: 1, id: "CD-14", clauses: [CLASS_SYNTAX_DEFINITION] }),
  }),
  "/install/mechanisms/audit/CD-14/piece.json": presentFile({
    text: JSON.stringify({
      version: 1,
      discipline: "CD-14",
      mechanism: "audit",
      clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }],
    }),
  }),
  "/install/mechanisms/audit/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
  "/repo/src/a.ts": presentFile({ text: "class A {}\n" }),
});

const CLASS_SYNTAX_SELECTED = classSyntaxSelectedWith({});

const fileTextOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => files[path].read,
  exists: ({ path }) => files[path].presence,
  write: vi.fn<FileTextPort["write"]>(),
});

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/repo","disciplines.json"]': "/repo/disciplines.json",
  '["/repo","discipline-exceptions.json"]': "/repo/discipline-exceptions.json",
  '["/repo","src/a.ts"]': "/repo/src/a.ts",
  '["/install","rules","CD-14","discipline.json"]': "/install/rules/CD-14/discipline.json",
  '["/install","mechanisms","audit","CD-14","piece.json"]': "/install/mechanisms/audit/CD-14/piece.json",
  '["/install","mechanisms","audit","CD-14"]': "/install/mechanisms/audit/CD-14",
  '["/install","mechanisms","audit","runner","runner.ts"]': "/install/mechanisms/audit/runner/runner.ts",
};

const FILE_CARVE_OUT_ON_A = JSON.stringify({
  version: 1,
  exceptions: [
    {
      kind: "file-carve-out",
      clause: "CD-14#class-syntax",
      file: "src/a.ts",
      reason: "legacy class awaiting paydown",
      whyChain: CAUSAL_WHY_CHAIN,
    },
  ],
});

const FILE_PATHS: Readonly<Record<string, string>> = {
  [ENTRY_URL]: "/install/core/check/tool-command.ts",
};

const DIRECTORIES: Readonly<Record<string, string>> = {
  "/install/core/check/tool-command.ts": "/install/core/check",
  "/install/core/check": "/install/core",
  "/install/core": "/install",
};

const TABLE_PATH: PathPort = {
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: ({ path }) => requiredEntry({ table: DIRECTORIES, key: path }),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: ({ path }) => ({ outcome: "ok", value: absolutePathSchema.parse(path) }),
  fromFileUrl: ({ url }) => ({ outcome: "ok", value: absolutePathSchema.parse(FILE_PATHS[url]) }),
};

const HIT_IN_A = {
  clause: { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" },
  file: "src/a.ts",
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
};

const standaloneRunner = (request: { readonly runReturns: unknown }): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>().mockResolvedValue(request.runReturns),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const modulesLoading = (module: unknown): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: module }),
});

const gitTracking = (paths: readonly RepoPath[]): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: paths }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
});

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandRequest = (overrides: Partial<CommandRequest>): CommandRequest => ({
  process: processWith({ arguments: ["--repo", "/repo"] }),
  path: TABLE_PATH,
  fileText: fileTextOver(NOTHING_SELECTED),
  modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [] } }) }),
  git: gitTracking([]),
  moduleUrl: ENTRY_URL,
  ...overrides,
});

const outputOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

describe("runCheckCommand", () => {
  it("exits 2 with the arguments-invalid line when an argument is unknown", async () => {
    const processPort = processWith({ arguments: ["--bogus", "x"] });

    await runCheckCommand(commandRequest({ process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 0 printing the pass verdict when the report is clean", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runCheckCommand(commandRequest({ process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "verdict: pass\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("exits 1 writing the report once when the runner finds a hit", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runCheckCommand(
      commandRequest({
        process: processPort,
        fileText: fileTextOver(CLASS_SYNTAX_SELECTED),
        modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [HIT_IN_A] } }) }),
        git: gitTracking([repoPathSchema.parse("src/a.ts")]),
      }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nverdict: fail\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("loads the runner from the install three levels above the entry file", async () => {
    const modules = modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [] } }) });

    await runCheckCommand(
      commandRequest({ fileText: fileTextOver(CLASS_SYNTAX_SELECTED), modules, git: gitTracking([repoPathSchema.parse("src/a.ts")]) }),
    );

    expect(vi.mocked(modules.load).mock.calls).toEqual([
      [{ path: "/install/mechanisms/audit/runner/runner.ts" }],
    ]);
  });

  it("measures the change set against the --base-revision it is given when a file carve-out needs it", async () => {
    const git = gitTracking([repoPathSchema.parse("src/a.ts")]);

    await runCheckCommand(
      commandRequest({
        process: processWith({ arguments: ["--repo", "/repo", "--base-revision", "main"] }),
        fileText: fileTextOver({
          ...CLASS_SYNTAX_SELECTED,
          "/repo/discipline-exceptions.json": presentFile({ text: FILE_CARVE_OUT_ON_A }),
        }),
        git,
      }),
    );

    expect(vi.mocked(git.changedSince).mock.calls).toEqual([[{ repoRoot: "/repo", baseRevision: "main" }]]);
  });
});

const checkedWith = async (request: {
  readonly arguments: readonly string[];
  readonly settings: Readonly<Record<string, unknown>>;
}) => {
  const processPort = processWith({ arguments: request.arguments });
  await runCheckCommand(
    commandRequest({
      process: processPort,
      fileText: fileTextOver(classSyntaxSelectedWith(request.settings)),
      modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [HIT_IN_A] } }) }),
      git: gitTracking([repoPathSchema.parse("src/a.ts")]),
    }),
  );
  return outputOf({ process: processPort });
};

const FAILING_FULL_REPORT = "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nverdict: fail\n";

describe("runCheckCommand report output", () => {
  it("prints the full report when neither --report-output nor disciplines.json sets an output", async () => {
    expect(await checkedWith({ arguments: ["--repo", "/repo"], settings: {} })).toEqual({
      writes: [[{ text: FAILING_FULL_REPORT }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("prints the output disciplines.json sets when --report-output is not given", async () => {
    expect(await checkedWith({ arguments: ["--repo", "/repo"], settings: { reportOutput: "counts" } })).toEqual({
      writes: [[{ text: "findings (1)\nverdict: fail\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("prints the output --report-output requests over the one disciplines.json sets", async () => {
    expect(
      await checkedWith({
        arguments: ["--repo", "/repo", "--report-output", "full"],
        settings: { reportOutput: "verdict-only" },
      }),
    ).toEqual({ writes: [[{ text: FAILING_FULL_REPORT }]], exits: [[{ code: 1 }]] });
  });

  it.each(reportOutputSchema.options)("exits 1 for a failing run requested as %s", async (output) => {
    expect((await checkedWith({ arguments: ["--repo", "/repo", "--report-output", output], settings: {} })).exits).toEqual(
      [[{ code: 1 }]],
    );
  });

  it.each(reportOutputSchema.options)("exits 1 for a failing run configured as %s", async (reportOutput) => {
    expect((await checkedWith({ arguments: ["--repo", "/repo"], settings: { reportOutput } })).exits).toEqual([
      [{ code: 1 }],
    ]);
  });

  it.each(reportOutputSchema.options)("exits 0 printing the pass verdict for a clean run requested as %s", async (output) => {
    const processPort = processWith({ arguments: ["--repo", "/repo", "--report-output", output] });

    await runCheckCommand(commandRequest({ process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({ writes: [[{ text: "verdict: pass\n" }]], exits: [[{ code: 0 }]] });
  });

  it("exits 2 with the arguments-invalid line naming --report-output when its value is not an output", async () => {
    expect(await checkedWith({ arguments: ["--repo", "/repo", "--report-output", "summary"], settings: {} })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid .*--report-output/) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the file-malformed line when disciplines.json sets an output that is not one", async () => {
    expect(await checkedWith({ arguments: ["--repo", "/repo"], settings: { reportOutput: "summary" } })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: file-malformed \/repo\/disciplines\.json .*reportOutput/) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the file-malformed line for an invalid disciplines.json output even when --report-output is given", async () => {
    expect(
      await checkedWith({ arguments: ["--repo", "/repo", "--report-output", "full"], settings: { reportOutput: "summary" } }),
    ).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: file-malformed \/repo\/disciplines\.json /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the file-unreadable line when disciplines.json cannot be read, whatever --report-output requests", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo", "--report-output", "verdict-only"] });

    await runCheckCommand(
      commandRequest({
        process: processPort,
        fileText: fileTextOver({
          ...NOTHING_SELECTED,
          "/repo/disciplines.json": {
            presence: "present",
            read: { outcome: "failed", error: { kind: "unreadable", path: "/repo/disciplines.json", detail: "EACCES" } },
          },
        }),
      }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "load failure: file-unreadable /repo/disciplines.json EACCES\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});

const carvedRunWith = async (request: {
  readonly arguments: readonly string[];
  readonly settings: Readonly<Record<string, unknown>>;
}) => {
  const processPort = processWith({ arguments: request.arguments });
  const git = gitTracking([repoPathSchema.parse("src/a.ts")]);
  vi.mocked(git.changedSince).mockReturnValue({ outcome: "ok", value: [repoPathSchema.parse("src/a.ts")] });
  await runCheckCommand(
    commandRequest({
      process: processPort,
      fileText: fileTextOver({
        ...classSyntaxSelectedWith(request.settings),
        "/repo/discipline-exceptions.json": presentFile({ text: FILE_CARVE_OUT_ON_A }),
      }),
      modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [HIT_IN_A] } }) }),
      git,
    }),
  );
  return { ...outputOf({ process: processPort }), changedSince: vi.mocked(git.changedSince).mock.calls };
};

const FORFEITED_FULL_REPORT =
  "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nforfeited (1)\nCD-14#class-syntax audit file-carve-out src/a.ts\nverdict: fail\n";

const ELSEWHERE_FULL_REPORT =
  "exempted (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {} exempted by file-carve-out\nassessment (1)\nforfeiture elsewhere: 1 file carve-out not checked for decay in this run\nverdict: pass (partial assessment)\n";

describe("runCheckCommand forfeiture assessment", () => {
  it("assesses forfeiture in this run when neither --forfeiture nor disciplines.json sets it", async () => {
    expect(
      await carvedRunWith({ arguments: ["--repo", "/repo", "--base-revision", "main"], settings: {} }),
    ).toEqual({
      writes: [[{ text: FORFEITED_FULL_REPORT }]],
      exits: [[{ code: 1 }]],
      changedSince: [[{ repoRoot: "/repo", baseRevision: "main" }]],
    });
  });

  it("leaves forfeiture to another run when disciplines.json sets it elsewhere, and says so", async () => {
    expect(
      await carvedRunWith({ arguments: ["--repo", "/repo"], settings: { assessment: { forfeiture: "elsewhere" } } }),
    ).toEqual({ writes: [[{ text: ELSEWHERE_FULL_REPORT }]], exits: [[{ code: 0 }]], changedSince: [] });
  });

  it("leaves forfeiture to another run when --forfeiture elsewhere is given", async () => {
    expect(await carvedRunWith({ arguments: ["--repo", "/repo", "--forfeiture", "elsewhere"], settings: {} })).toEqual({
      writes: [[{ text: ELSEWHERE_FULL_REPORT }]],
      exits: [[{ code: 0 }]],
      changedSince: [],
    });
  });

  it("assesses forfeiture when --forfeiture this-run overrides elsewhere in disciplines.json", async () => {
    expect(
      await carvedRunWith({
        arguments: ["--repo", "/repo", "--forfeiture", "this-run", "--base-revision", "main"],
        settings: { assessment: { forfeiture: "elsewhere" } },
      }),
    ).toMatchObject({ exits: [[{ code: 1 }]], changedSince: [[{ repoRoot: "/repo", baseRevision: "main" }]] });
  });

});

describe("runCheckCommand forfeiture assessment defaults and outputs", () => {
  it("prints a report byte-identical to today's when disciplines.json sets forfeiture to this-run", async () => {
    const defaulted = await carvedRunWith({ arguments: ["--repo", "/repo", "--base-revision", "main"], settings: {} });

    expect(
      await carvedRunWith({
        arguments: ["--repo", "/repo", "--base-revision", "main"],
        settings: { assessment: { forfeiture: "this-run" } },
      }),
    ).toEqual(defaulted);
  });

  it.each(["counts", "failures-only", "verdict-only"])("marks the verdict as partial for the %s output", async (output) => {
    const run = await carvedRunWith({
      arguments: ["--repo", "/repo", "--forfeiture", "elsewhere", "--report-output", output],
      settings: {},
    });

    expect(run.writes).toEqual([[{ text: expect.stringMatching(/(?:^|\n)verdict: pass \(partial assessment\)\n$/) }]]);
  });

});

describe("runCheckCommand forfeiture elsewhere with a base revision", () => {
  it("runs with --forfeiture elsewhere and --base-revision, forfeiting nothing and asking git for no change set", async () => {
    expect(
      await carvedRunWith({
        arguments: ["--repo", "/repo", "--forfeiture", "elsewhere", "--base-revision", "main"],
        settings: {},
      }),
    ).toEqual({ writes: [[{ text: ELSEWHERE_FULL_REPORT }]], exits: [[{ code: 0 }]], changedSince: [] });
  });

  it("runs with --base-revision when disciplines.json sets forfeiture elsewhere, forfeiting nothing", async () => {
    expect(
      await carvedRunWith({
        arguments: ["--repo", "/repo", "--base-revision", "main"],
        settings: { assessment: { forfeiture: "elsewhere" } },
      }),
    ).toEqual({ writes: [[{ text: ELSEWHERE_FULL_REPORT }]], exits: [[{ code: 0 }]], changedSince: [] });
  });
});

describe("runCheckCommand assessment configuration", () => {
  it("exits 2 with the file-malformed line naming eslint, which this release does not assess", async () => {
    expect(
      (await carvedRunWith({ arguments: ["--repo", "/repo"], settings: { assessment: { eslint: { evidence: "hone" } } } })).writes,
    ).toEqual([[{ text: expect.stringMatching(/^load failure: file-malformed \/repo\/disciplines\.json .*not available in this version: "eslint"/) }]]);
  });

  it("exits 2 with the file-malformed line naming the removed waivedClauses and the clause states that replace it", async () => {
    expect(
      (await carvedRunWith({ arguments: ["--repo", "/repo"], settings: { assessment: { waivedClauses: "not-run" } } })).writes,
    ).toEqual([[{ text: expect.stringMatching(/^load failure: file-malformed \/repo\/disciplines\.json .*removed: "waivedClauses"; in clauses, mark a clause "not-run"/) }]]);
  });

  it("exits 2 with the arguments-invalid line naming the removed --waived-clauses and the clause values that replace it", async () => {
    expect((await carvedRunWith({ arguments: ["--repo", "/repo", "--waived-clauses", "not-run"], settings: {} })).writes).toEqual([
      [{ text: expect.stringMatching(/^load failure: arguments-invalid removed: "--waived-clauses"; in clauses, mark a clause "not-run"/) }],
    ]);
  });

  it("exits 2 with the file-malformed line when disciplines.json sets a forfeiture that is not one", async () => {
    expect(
      (await carvedRunWith({ arguments: ["--repo", "/repo"], settings: { assessment: { forfeiture: "reported" } } })).writes,
    ).toEqual([[{ text: expect.stringMatching(/^load failure: file-malformed \/repo\/disciplines\.json .*forfeiture/) }]]);
  });
});
