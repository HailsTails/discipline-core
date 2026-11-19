import { describe, expect, it, vi } from "vitest";
import { recordsDisk, singleFileRepositoriesOver } from "../../tests/records-disk.ts";
import { requiredEntry } from "../../tests/required-entry.ts";
import { exceptionRepositoryOf } from "../exception-records/exception-layout.ts";
import type { LoadedRunner } from "../mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createPathPort, type PathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { CommandRequest } from "./run-check-command.ts";
import { runPruneDebtCommand } from "./run-prune-debt-command.ts";

const ENTRY_URL = "file:///install/core/check/tool-command.ts";

const EXCEPTIONS_PATH = "/repo/discipline-exceptions.json";

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

const CD_14_DISCIPLINE = `{
  "version": 1,
  "id": "CD-14",
  "clauses": [
    {
      "kind": "mechanical",
      "id": "class-syntax",
      "summary": "no class syntax",
      "mechanisms": ["audit"],
      "anchor": { "kind": "keyword", "keyword": "class" },
      "cases": {
        "flag": [{ "name": "flagged", "fileName": "src/a.ts", "source": "class A {}\\n", "expectedLines": [1] }],
        "allow": [{ "name": "allowed", "fileName": "src/b.ts", "source": "const b = 1;\\n", "expectedLines": [] }]
      }
    }
  ]
}`;

const CARVED_A = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-14#class-syntax",
      "file": "src/a.ts"
    }
  ]
}
`;

const EMPTY_EXCEPTIONS = `{
  "version": 1,
  "exceptions": []
}
`;

const AUTHORISED_A = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "authorised-location",
      "clause": "CD-14#class-syntax",
      "file": "src/a.ts",
      "reason": "the wrapping factory"
    }
  ]
}
`;

const repositoryFiles = (request: { readonly exceptions: string }): Readonly<Record<string, FakeFile>> => ({
  "/repo/disciplines.json": presentFile({
    text: '{ "version": 1, "ruleSets": {}, "clauses": { "CD-14#class-syntax": "audit" } }',
  }),
  [EXCEPTIONS_PATH]: presentFile({ text: request.exceptions }),
  "/repo/discipline-exceptions": ABSENT_FILE,
  "/install/package.json": ABSENT_FILE,
  "/install/rules/CD-14/discipline.json": presentFile({
    text: CD_14_DISCIPLINE,
  }),
  "/install/mechanisms/audit/CD-14/piece.json": presentFile({
    text: '{ "version": 1, "discipline": "CD-14", "mechanism": "audit", "clauses": [{ "clause": "class-syntax", "settings": { "module": "class-syntax.ts" } }] }',
  }),
  "/install/mechanisms/audit/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
  "/repo/src/a.ts": presentFile({ text: "class A {}\n" }),
  "/repo/disciplines.assessment.md": ABSENT_FILE,
  "/install/rules/CD-14/README.md": presentFile({ text: "# CD-14\n" }),
});

const fileTextOver = (request: { readonly files: Readonly<Record<string, FakeFile>> }): FileTextPort => ({
  read: ({ path }) => requiredEntry({ table: request.files, key: path }).read,
  exists: ({ path }) => requiredEntry({ table: request.files, key: path }).presence,
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const POSIX_PATH: PathPort = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const HIT_IN_A = {
  clause: { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" },
  file: "src/a.ts",
  anchor: { line: 1, column: 0 },
  snippet: "class A {}",
};

const runnerFinding = (request: { readonly hits: readonly unknown[] }): ModuleLoaderPort => {
  const runner: LoadedRunner = {
    exceptionPath: "standalone",
    run: vi.fn<LoadedRunner["run"]>().mockResolvedValue({ outcome: "ok", value: { hits: request.hits, nativeExceptions: [] } }),
    conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  };
  return { load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: { runner } }) };
};

const SOURCE_A = repoPathSchema.parse("src/a.ts");

const gitChanging = (changed: readonly RepoPath[]): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: [SOURCE_A] }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: changed }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
});

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

type Run = {
  readonly arguments: readonly string[];
  readonly exceptions: string;
  readonly git: GitPort;
  readonly modules: ModuleLoaderPort;
};

const staleRun = (): Run => ({
  arguments: ["--repo", "/repo"],
  exceptions: CARVED_A,
  git: gitChanging([]),
  modules: runnerFinding({ hits: [] }),
});

const forfeitedRun = (): Run => ({
  arguments: ["--repo", "/repo", "--base-revision", "origin/main"],
  exceptions: CARVED_A,
  git: gitChanging([SOURCE_A]),
  modules: runnerFinding({ hits: [] }),
});

const prunedDebt = async (request: Run) => {
  const processPort = processWith({ arguments: request.arguments });
  const fileText = fileTextOver({ files: repositoryFiles({ exceptions: request.exceptions }) });
  const command: CommandRequest = {
    process: processPort,
    path: POSIX_PATH,
    fileText,
    modules: request.modules,
    git: request.git,
    exceptionRepositoryOf: singleFileRepositoriesOver({ path: POSIX_PATH, fileText, git: request.git }),
    moduleUrl: ENTRY_URL,
  };
  await runPruneDebtCommand(command);
  return {
    writes: vi.mocked(processPort.writeOut).mock.calls,
    exits: vi.mocked(processPort.exitWith).mock.calls,
    files: vi.mocked(fileText.write).mock.calls,
  };
};

describe("runPruneDebtCommand removing paid debt", () => {
  it("removes a stale file carve-out and prints the pair", async () => {
    expect(await prunedDebt(staleRun())).toEqual({
      writes: [[{ text: "CD-14#class-syntax removed src/a.ts\n" }]],
      exits: [[{ code: 0 }]],
      files: [[{ path: EXCEPTIONS_PATH, text: EMPTY_EXCEPTIONS }]],
    });
  });

  it("removes a forfeited file carve-out whose file no longer breaks its clause", async () => {
    expect(await prunedDebt(forfeitedRun())).toEqual({
      writes: [[{ text: "CD-14#class-syntax removed src/a.ts\n" }]],
      exits: [[{ code: 0 }]],
      files: [[{ path: EXCEPTIONS_PATH, text: EMPTY_EXCEPTIONS }]],
    });
  });

  it("asks git for the files changed since the --base-revision it is given", async () => {
    const run = forfeitedRun();

    await prunedDebt(run);

    expect(vi.mocked(run.git.changedSince).mock.calls).toEqual([[expect.objectContaining({ baseRevision: "origin/main" })]]);
  });
});

describe("runPruneDebtCommand leaving debt that is not paid", () => {
  it("keeps a forfeited file carve-out whose file still breaks its clause, printing nothing", async () => {
    expect(await prunedDebt({ ...forfeitedRun(), modules: runnerFinding({ hits: [HIT_IN_A] }) })).toEqual({ writes: [[{ text: "" }]], exits: [[{ code: 0 }]], files: [] });
  });

  it("keeps a file carve-out that exempts a finding", async () => {
    expect(await prunedDebt({ ...staleRun(), modules: runnerFinding({ hits: [HIT_IN_A] }) })).toEqual({ writes: [[{ text: "" }]], exits: [[{ code: 0 }]], files: [] });
  });

  it("leaves a stale authorised location to a person", async () => {
    expect(await prunedDebt({ ...staleRun(), exceptions: AUTHORISED_A })).toEqual({ writes: [[{ text: "" }]], exits: [[{ code: 0 }]], files: [] });
  });
});

describe("runPruneDebtCommand failing to load", () => {
  it("exits 2 without running anything when --repo is missing", async () => {
    expect(await prunedDebt({ ...staleRun(), arguments: [] })).toEqual({
      writes: [[{ text: "load failure: arguments-invalid hone prune-debt needs --repo <dir>: the folder that holds disciplines.json, usually the repository root\n" }]],
      exits: [[{ code: 2 }]],
      files: [],
    });
  });
});

describe("runPruneDebtCommand in the split layout", () => {
  it("removes the record from the file that keeps that rule's file carve-outs", async () => {
    const disk = recordsDisk({ working: { "discipline-exceptions/file-carve-outs/cd-14.json": CARVED_A }, base: {} });
    const run = staleRun();
    const processPort = processWith({ arguments: run.arguments });

    await runPruneDebtCommand({
      process: processPort,
      path: POSIX_PATH,
      fileText: fileTextOver({ files: repositoryFiles({ exceptions: EMPTY_EXCEPTIONS }) }),
      modules: run.modules,
      git: run.git,
      exceptionRepositoryOf: exceptionRepositoryOf(disk.ports),
      moduleUrl: ENTRY_URL,
    });

    expect(disk.texts()).toEqual({ "discipline-exceptions/file-carve-outs/cd-14.json": EMPTY_EXCEPTIONS });
  });
});
