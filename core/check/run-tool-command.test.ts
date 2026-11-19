import { describe, expect, it, vi } from "vitest";
import { requiredEntry } from "../../tests/required-entry.ts";
import type { ExceptionRepositoryOf } from "../exception-records/exception-records.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createPathPort, type PathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import { helpText } from "./command-help.ts";
import type { CommandRequest } from "./run-check-command.ts";
import { type CommandHandler, type Subcommands, toolCommandOf } from "./run-tool-command.ts";

const ENTRY_URL = "file:///install/core/check/tool-command.ts";

const UNUSED_PATH: PathPort = {
  join: vi.fn<PathPort["join"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const UNUSED_FILE_TEXT: FileTextPort = {
  read: vi.fn<FileTextPort["read"]>(),
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>(),
};

const UNUSED_MODULES: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };

const UNUSED_GIT: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
};

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandRequest = (request: { readonly process: ProcessPort }): CommandRequest => ({
  process: request.process,
  path: UNUSED_PATH,
  fileText: UNUSED_FILE_TEXT,
  modules: UNUSED_MODULES,
  git: UNUSED_GIT,
  exceptionRepositoryOf: vi.fn<ExceptionRepositoryOf>(),
  moduleUrl: ENTRY_URL,
});

const subcommandsSpied = (): Subcommands => ({
  check: vi.fn<CommandHandler>().mockResolvedValue(undefined),
  project: vi.fn<CommandHandler>().mockResolvedValue(undefined),
  "record-debt": vi.fn<CommandHandler>().mockResolvedValue(undefined),
  "prune-debt": vi.fn<CommandHandler>().mockResolvedValue(undefined),
  "split-records": vi.fn<CommandHandler>().mockResolvedValue(undefined),
});

type SubcommandCalls = {
  readonly check: readonly Parameters<CommandHandler>[];
  readonly project: readonly Parameters<CommandHandler>[];
  readonly recordDebt: readonly Parameters<CommandHandler>[];
  readonly pruneDebt: readonly Parameters<CommandHandler>[];
};

const callsOf = (request: { readonly subcommands: Subcommands }): SubcommandCalls => ({
  check: vi.mocked(request.subcommands.check).mock.calls,
  project: vi.mocked(request.subcommands.project).mock.calls,
  recordDebt: vi.mocked(request.subcommands["record-debt"]).mock.calls,
  pruneDebt: vi.mocked(request.subcommands["prune-debt"]).mock.calls,
});

const outputOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

describe("toolCommandOf", () => {
  it("runs the check subcommand with the same ports and the arguments after it", async () => {
    const subcommands = subcommandsSpied();
    const request = commandRequest({ process: processWith({ arguments: ["check", "--repo", "/repo"] }) });

    await toolCommandOf({ subcommands })(request);

    expect(callsOf({ subcommands })).toEqual({
      check: [[{ ...request, process: { ...request.process, arguments: ["--repo", "/repo"] } }]],
      project: [],
      recordDebt: [],
      pruneDebt: [],
    });
  });

  it("runs the project subcommand with the same ports and the arguments after it", async () => {
    const subcommands = subcommandsSpied();
    const request = commandRequest({ process: processWith({ arguments: ["project", "--repo", "/repo"] }) });

    await toolCommandOf({ subcommands })(request);

    expect(callsOf({ subcommands })).toEqual({
      check: [],
      project: [[{ ...request, process: { ...request.process, arguments: ["--repo", "/repo"] } }]],
      recordDebt: [],
      pruneDebt: [],
    });
  });

  it("runs the record-debt subcommand with the same ports and the arguments after it", async () => {
    const subcommands = subcommandsSpied();
    const request = commandRequest({ process: processWith({ arguments: ["record-debt", "--repo", "/repo", "--base-revision", "HEAD"] }) });

    await toolCommandOf({ subcommands })(request);

    expect(callsOf({ subcommands })).toEqual({
      check: [],
      project: [],
      recordDebt: [[{ ...request, process: { ...request.process, arguments: ["--repo", "/repo", "--base-revision", "HEAD"] } }]],
      pruneDebt: [],
    });
  });

  it("runs the prune-debt subcommand with the same ports and the arguments after it", async () => {
    const subcommands = subcommandsSpied();
    const request = commandRequest({ process: processWith({ arguments: ["prune-debt", "--repo", "/repo", "--base-revision", "origin/main"] }) });

    await toolCommandOf({ subcommands })(request);

    expect(callsOf({ subcommands })).toEqual({
      check: [],
      project: [],
      recordDebt: [],
      pruneDebt: [[{ ...request, process: { ...request.process, arguments: ["--repo", "/repo", "--base-revision", "origin/main"] } }]],
    });
  });
});

const ranNothing = { check: [], project: [], recordDebt: [], pruneDebt: [] };

describe("toolCommandOf refusing an invocation it cannot read", () => {
  it.each([
    { given: [], line: "load failure: arguments-invalid hone needs a command, check, project, record-debt, prune-debt or split-records; run hone --help for usage\n" },
    {
      given: ["lint", "--repo", "/repo"],
      line: 'load failure: arguments-invalid hone has no command "lint"; its commands are check, project, record-debt, prune-debt and split-records; run hone --help for usage\n',
    },
  ])("exits 2 with the arguments-invalid line and runs nothing, given $given", async ({ given, line }) => {
    const subcommands = subcommandsSpied();
    const processPort = processWith({ arguments: given });

    await toolCommandOf({ subcommands })(commandRequest({ process: processPort }));

    expect({ output: outputOf({ process: processPort }), ran: callsOf({ subcommands }) }).toEqual({
      output: { writes: [[{ text: line }]], exits: [[{ code: 2 }]] },
      ran: ranNothing,
    });
  });
});

describe("toolCommandOf printing help", () => {
  it.each([
    { given: ["--help"], topic: "tool" },
    { given: ["check", "--repo", "/repo", "--help"], topic: "check" },
    { given: ["project", "-h"], topic: "project" },
  ] as const)("prints the $topic help and exits 0, running nothing, given $given", async ({ given, topic }) => {
    const subcommands = subcommandsSpied();
    const processPort = processWith({ arguments: given });

    await toolCommandOf({ subcommands })(commandRequest({ process: processPort }));

    expect({ output: outputOf({ process: processPort }), ran: callsOf({ subcommands }) }).toEqual({
      output: { writes: [[{ text: helpText({ topic }) }]], exits: [[{ code: 0 }]] },
      ran: ranNothing,
    });
  });
});

const PACKAGE_PATH = "/install/package.json";

const versionRequest = (request: { readonly process: ProcessPort; readonly read: ReturnType<FileTextPort["read"]> }): CommandRequest => ({
  ...commandRequest(request),
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: { ...UNUSED_FILE_TEXT, read: ({ path }) => requiredEntry({ table: { [PACKAGE_PATH]: request.read }, key: path }) },
});

describe("toolCommandOf printing the version", () => {
  it("prints the installed version and exits 0, running nothing", async () => {
    const subcommands = subcommandsSpied();
    const processPort = processWith({ arguments: ["--version"] });

    await toolCommandOf({ subcommands })(
      versionRequest({ process: processPort, read: { outcome: "ok", value: '{ "version": "1.2.3" }' } }),
    );

    expect({ output: outputOf({ process: processPort }), ran: callsOf({ subcommands }) }).toEqual({
      output: { writes: [[{ text: "1.2.3\n" }]], exits: [[{ code: 0 }]] },
      ran: ranNothing,
    });
  });

  it("exits 2 with the load failure line when the install's package.json cannot be read", async () => {
    const processPort = processWith({ arguments: ["--version"] });

    await toolCommandOf({ subcommands: subcommandsSpied() })(
      versionRequest({ process: processPort, read: { outcome: "failed", error: { kind: "unreadable", path: PACKAGE_PATH, detail: "EACCES" } } }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "load failure: file-unreadable /install/package.json EACCES\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});

const rejecting: CommandHandler = () => Promise.reject(new Error("Cannot read properties of undefined"));

const throwing: CommandHandler = () => Promise.resolve(BigInt("one")).then(() => undefined);

describe("toolCommandOf when a command fails unexpectedly", () => {
  it.each([
    { handler: rejecting, line: "load failure: unexpected-error Cannot read properties of undefined\n" },
    { handler: throwing, line: "load failure: unexpected-error Cannot convert one to a BigInt\n" },
  ])("exits 2 with an unexpected-error load failure line, so exit 1 always means a failing verdict: $line", async ({ handler, line }) => {
    const processPort = processWith({ arguments: ["check", "--repo", "/repo"] });

    await toolCommandOf({ subcommands: { check: handler, project: handler, "record-debt": handler, "prune-debt": handler, "split-records": handler } })(commandRequest({ process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({ writes: [[{ text: line }]], exits: [[{ code: 2 }]] });
  });
});
