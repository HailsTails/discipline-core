import { describe, expect, it, vi } from "vitest";
import { createDefaultExceptionRepositoryOf } from "../exception-records/exception-layout.ts";
import type { ExceptionRepository } from "../exception-records/exception-records.ts";
import { createDefaultFileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { CommandRequest } from "./run-check-command.ts";
import { runPruneDebtCommand } from "./run-prune-debt-command.ts";

const FIXTURE = `${import.meta.dirname}/../../tests/test-fixtures/prune-debt`;

const TOOL_COMMAND_URL = new URL("./tool-command.ts", import.meta.url).href;

const SETTLED_PAIR = { clause: clauseAddressSchema.parse("CD-15#loops"), file: repoPathSchema.parse("notes/settled.md") };

const FIXTURE_TRACKED = [
  repoPathSchema.parse("discipline-exceptions.json"),
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("notes/settled.md"),
];

const processGiven = (argumentsGiven: readonly string[]): ProcessPort => ({
  arguments: argumentsGiven,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const gitTrackingTheFixture = (): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: FIXTURE_TRACKED }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
});

const pruning = (request: {
  readonly process: ProcessPort;
  readonly git: GitPort;
  readonly remove: ExceptionRepository["remove"];
  readonly moduleUrl: string;
}): CommandRequest => ({
  process: request.process,
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  git: request.git,
  exceptionRepositoryOf: (repository) => ({ ...createDefaultExceptionRepositoryOf({})(repository), remove: request.remove }),
  moduleUrl: request.moduleUrl,
});

const removingWhatItIsGiven = () => vi.fn<ExceptionRepository["remove"]>().mockReturnValue({ outcome: "ok", value: [SETTLED_PAIR] });

describe("runPruneDebtCommand over a repository on disk, through this install's audit runner", () => {
  it("removes the carve-out on the tracked file the audit measured clean, keeps the one on a file git does not track, and exits 0", async () => {
    const process = processGiven(["--repo", FIXTURE]);
    const remove = removingWhatItIsGiven();
    await runPruneDebtCommand(pruning({ process, git: gitTrackingTheFixture(), remove, moduleUrl: TOOL_COMMAND_URL }));
    expect(remove).toHaveBeenCalledExactlyOnceWith({ pairs: [SETTLED_PAIR] });
    expect(process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 0 });
  });

  it("asks git for the files changed since the --base-revision it is given", async () => {
    const git = gitTrackingTheFixture();
    await runPruneDebtCommand(
      pruning({ process: processGiven(["--repo", FIXTURE, "--base-revision", "origin/main"]), git, remove: removingWhatItIsGiven(), moduleUrl: TOOL_COMMAND_URL }),
    );
    expect(git.changedSince).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ baseRevision: "origin/main" }));
  });

  it("asks git for no change set when --forfeiture elsewhere leaves forfeiture to another run", async () => {
    const git = gitTrackingTheFixture();
    await runPruneDebtCommand(
      pruning({
        process: processGiven(["--repo", FIXTURE, "--base-revision", "origin/main", "--forfeiture", "elsewhere"]),
        git,
        remove: removingWhatItIsGiven(),
        moduleUrl: TOOL_COMMAND_URL,
      }),
    );
    expect(git.changedSince).not.toHaveBeenCalled();
  });
});

describe("runPruneDebtCommand failing before it reaches the records", () => {
  it("exits 2 with the arguments-invalid line, removing nothing, when an argument is unknown", async () => {
    const process = processGiven(["--repo", FIXTURE, "--leave", "notes/settled.md"]);
    const remove = vi.fn<ExceptionRepository["remove"]>();
    await runPruneDebtCommand(pruning({ process, git: gitTrackingTheFixture(), remove, moduleUrl: TOOL_COMMAND_URL }));
    expect(process.writeOut).toHaveBeenCalledExactlyOnceWith({ text: expect.stringMatching(/^load failure: arguments-invalid /) });
    expect(process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 2 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("exits 2 with the selection-absent line, removing nothing, when --repo holds no disciplines.json", async () => {
    const process = processGiven(["--repo", `${FIXTURE}/notes`]);
    const remove = vi.fn<ExceptionRepository["remove"]>();
    await runPruneDebtCommand(pruning({ process, git: gitTrackingTheFixture(), remove, moduleUrl: TOOL_COMMAND_URL }));
    expect(process.writeOut).toHaveBeenCalledExactlyOnceWith({ text: expect.stringMatching(/^load failure: selection-absent /) });
    expect(process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 2 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("exits 2 with the install-root-unresolvable line, removing nothing, when its module URL is not a file URL", async () => {
    const process = processGiven(["--repo", FIXTURE]);
    const remove = vi.fn<ExceptionRepository["remove"]>();
    await runPruneDebtCommand(pruning({ process, git: gitTrackingTheFixture(), remove, moduleUrl: "https://example.invalid/tool-command.ts" }));
    expect(process.writeOut).toHaveBeenCalledExactlyOnceWith({ text: expect.stringMatching(/^load failure: install-root-unresolvable /) });
    expect(process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 2 });
    expect(remove).not.toHaveBeenCalled();
  });
});
