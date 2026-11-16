import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import type { CommandRequest } from "./run-check-command.ts";
import { type CommandHandler, toolCommandOf } from "./run-tool-command.ts";

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
  moduleUrl: ENTRY_URL,
});

const subcommandsSpied = () => ({
  check: vi.fn<CommandHandler>().mockResolvedValue(undefined),
  project: vi.fn<CommandHandler>().mockResolvedValue(undefined),
});

const callsOf = (request: { readonly subcommands: ReturnType<typeof subcommandsSpied> }) => ({
  check: vi.mocked(request.subcommands.check).mock.calls,
  project: vi.mocked(request.subcommands.project).mock.calls,
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
    });
  });

  it("runs the project subcommand with the same ports and the arguments after it", async () => {
    const subcommands = subcommandsSpied();
    const request = commandRequest({ process: processWith({ arguments: ["project", "--repo", "/repo"] }) });

    await toolCommandOf({ subcommands })(request);

    expect(callsOf({ subcommands })).toEqual({
      check: [],
      project: [[{ ...request, process: { ...request.process, arguments: ["--repo", "/repo"] } }]],
    });
  });

  it("exits 2 with the arguments-invalid usage line and runs nothing when no subcommand is given", async () => {
    const subcommands = subcommandsSpied();
    const processPort = processWith({ arguments: [] });

    await toolCommandOf({ subcommands })(commandRequest({ process: processPort }));

    expect({ output: outputOf({ process: processPort }), ran: callsOf({ subcommands }) }).toEqual({
      output: {
        writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid a subcommand is required; usage: hone check --repo /) }]],
        exits: [[{ code: 2 }]],
      },
      ran: { check: [], project: [] },
    });
  });

  it("exits 2 with the arguments-invalid usage line and runs nothing for an unknown subcommand", async () => {
    const subcommands = subcommandsSpied();
    const processPort = processWith({ arguments: ["lint", "--repo", "/repo"] });

    await toolCommandOf({ subcommands })(commandRequest({ process: processPort }));

    expect({ output: outputOf({ process: processPort }), ran: callsOf({ subcommands }) }).toEqual({
      output: {
        writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid unknown subcommand "lint"; usage: hone check --repo /) }]],
        exits: [[{ code: 2 }]],
      },
      ran: { check: [], project: [] },
    });
  });
});
