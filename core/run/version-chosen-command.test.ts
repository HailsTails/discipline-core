import { describe, expect, it, vi } from "vitest";
import type { ExceptionRepositoryOf } from "../upgrade/version-one-records/exception-records.ts";
import type { FilePresence, FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import type { CommandRequest } from "../check/run-check-command.ts";
import { notReadyCommandOf, type VersionedHandler, versionChosenCommandOf } from "./version-chosen-command.ts";

type Presences = { readonly versionOne: FilePresence; readonly versionTwo: FilePresence };

const VERSION_ONE_ONLY: Presences = { versionOne: "present", versionTwo: "absent" };

const VERSION_TWO_ONLY: Presences = { versionOne: "absent", versionTwo: "present" };

const BOTH: Presences = { versionOne: "present", versionTwo: "present" };

const NEITHER: Presences = { versionOne: "absent", versionTwo: "absent" };

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandOver = (request: { readonly process: ProcessPort; readonly present: Presences }): CommandRequest => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: {
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce(request.present.versionOne).mockReturnValueOnce(request.present.versionTwo),
    read: vi.fn<FileTextPort["read"]>(),
    write: vi.fn<FileTextPort["write"]>(),
  },
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
    changedSince: vi.fn<GitPort["changedSince"]>(),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
  },
  exceptionRepositoryOf: vi.fn<ExceptionRepositoryOf>(),
  moduleUrl: "file:///install/core/check/tool-command.ts",
});

const handlers = () => ({
  versionOne: vi.fn<VersionedHandler>().mockResolvedValue(undefined),
  versionTwo: vi.fn<VersionedHandler>().mockResolvedValue(undefined),
});

describe("versionChosenCommandOf", () => {
  it.each([
    { repo: "versionOne", present: VERSION_ONE_ONLY, ran: { versionOne: 1, versionTwo: 0 } },
    { repo: "versionTwo", present: VERSION_TWO_ONLY, ran: { versionOne: 0, versionTwo: 1 } },
    { repo: "neither", present: NEITHER, ran: { versionOne: 1, versionTwo: 0 } },
  ])("runs the handler for the settings file the repository holds, given $repo", async ({ present, ran }) => {
    const chosen = handlers();
    const command = commandOver({ process: processWith({ arguments: ["--repo", "/repo"] }), present });

    await versionChosenCommandOf(chosen)(command);

    expect({ versionOne: vi.mocked(chosen.versionOne).mock.calls.length, versionTwo: vi.mocked(chosen.versionTwo).mock.calls.length }).toEqual(ran);
  });

  it("hands the version 1 handler the very request it was given, unchanged", async () => {
    const chosen = handlers();
    const command = commandOver({ process: processWith({ arguments: ["--repo", "/repo"] }), present: VERSION_ONE_ONLY });

    await versionChosenCommandOf(chosen)(command);

    expect(vi.mocked(chosen.versionOne).mock.calls).toEqual([[command]]);
  });

  it("leaves a request with no repository to the version 1 handler, which refuses it as it does today", async () => {
    const chosen = handlers();

    await versionChosenCommandOf(chosen)(commandOver({ process: processWith({ arguments: [] }), present: NEITHER }));

    expect(vi.mocked(chosen.versionOne).mock.calls.length).toBe(1);
  });

  it("prints the settings-in-both-versions line and exits 2, running neither handler, when the repository holds both settings files", async () => {
    const chosen = handlers();
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await versionChosenCommandOf(chosen)(commandOver({ process: processPort, present: BOTH }));

    expect({
      ran: [vi.mocked(chosen.versionOne).mock.calls.length, vi.mocked(chosen.versionTwo).mock.calls.length],
      writes: vi.mocked(processPort.writeOut).mock.calls,
      exits: vi.mocked(processPort.exitWith).mock.calls,
    }).toEqual({
      ran: [0, 0],
      writes: [[{ text: "load failure: settings-in-both-versions /repo: it holds both disciplines.json and hone.config.json; keep the one this repository runs on and remove the other\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});

describe("notReadyCommandOf", () => {
  it("prints one not-ready-yet line naming the command, and exits 2", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await notReadyCommandOf({ command: "prune-debt" })(commandOver({ process: processPort, present: NEITHER }));

    expect({ writes: vi.mocked(processPort.writeOut).mock.calls, exits: vi.mocked(processPort.exitWith).mock.calls }).toEqual({
      writes: [[{ text: "load failure: not-ready-yet prune-debt: this release runs prune-debt on version 1 files only, and this repository holds hone.config.json\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});
