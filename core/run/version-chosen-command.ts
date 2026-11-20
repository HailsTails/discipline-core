import type { Subcommand } from "../command-line/command-line.ts";
import { printOutcome, type CommandRequest } from "../check/run-check-command.ts";
import { runLoadFailureLine } from "../report/load-failure-lines.ts";
import type { RunLoadFailure } from "../report/run-load-failure.ts";
import { repoArgumentOf } from "./repo-argument.ts";
import { runPathOf } from "./run-path.ts";

const LOAD_FAILURE_CODE = 2;

export type VersionedHandler = (command: CommandRequest) => Promise<void>;

export type VersionChoice = {
  readonly versionOne: VersionedHandler;
  readonly versionTwo: VersionedHandler;
};

const printFailure = (request: { readonly command: CommandRequest; readonly failure: RunLoadFailure }): Promise<void> => {
  printOutcome({
    process: request.command.process,
    outcome: { code: LOAD_FAILURE_CODE, text: `${runLoadFailureLine({ failure: request.failure, upgradeCommand: undefined })}\n` },
  });
  return Promise.resolve();
};

export const versionChosenCommandOf =
  (request: VersionChoice): VersionedHandler =>
  (command) => {
    const repo = repoArgumentOf({ arguments: command.process.arguments });
    const resolved = repo === undefined ? undefined : command.path.resolve({ path: repo });
    if (resolved === undefined || resolved.outcome === "failed") {
      return request.versionOne(command);
    }
    const chosen = runPathOf({ fileText: command.fileText, path: command.path, repoRoot: resolved.value });
    if (chosen.outcome === "failed") {
      return printFailure({ command, failure: chosen.error });
    }
    return chosen.value === "version-2" ? request.versionTwo(command) : request.versionOne(command);
  };

export const notReadyCommandOf =
  (request: { readonly command: Subcommand }): VersionedHandler =>
  (command) =>
    printFailure({ command, failure: { kind: "not-ready-yet", what: { thing: "command", command: request.command } } });
