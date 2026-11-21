import type { Subcommand } from "../command-line/command-line.ts";
import type { CommandRequest } from "../command-line/command-request.ts";
import { printOutcome } from "../command-line/print-outcome.ts";
import type { RunLoadFailure } from "../report/run-load-failure.ts";
import { repoArgumentOf } from "./repo-argument.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { runLoadFailureOutcomeOf, upgradeCommandFor } from "./run-load-failure-outcome.ts";
import { runPathOf } from "./run-path.ts";

export type VersionedHandler<Request extends CommandRequest = CommandRequest> = (command: Request) => Promise<void>;

export type VersionChoice<Request extends CommandRequest> = {
  readonly versionOne: VersionedHandler<Request>;
  readonly versionTwo: VersionedHandler;
};

export const printFailure = (request: {
  readonly command: CommandRequest;
  readonly failure: RunLoadFailure;
  readonly repoRoot: AbsolutePath | undefined;
}): Promise<void> => {
  const upgradeCommand =
    request.repoRoot === undefined ? undefined : upgradeCommandFor({ path: request.command.path, moduleUrl: request.command.moduleUrl, repoRoot: request.repoRoot });
  printOutcome({ process: request.command.process, outcome: runLoadFailureOutcomeOf({ failure: request.failure, upgradeCommand }) });
  return Promise.resolve();
};

type NoSettingsHandler<Request extends CommandRequest> = (request: { readonly command: Request; readonly repoRoot: AbsolutePath }) => Promise<void>;

const chosenCommandOf =
  <Request extends CommandRequest>(request: VersionChoice<Request> & { readonly noSettings: NoSettingsHandler<Request> }): VersionedHandler<Request> =>
  (command) => {
    const repo = repoArgumentOf({ arguments: command.process.arguments });
    const resolved = repo === undefined ? undefined : command.path.resolve({ path: repo });
    if (resolved === undefined || resolved.outcome === "failed") {
      return request.versionOne(command);
    }
    const chosen = runPathOf({ fileText: command.fileText, path: command.path, repoRoot: resolved.value });
    if (chosen.outcome === "failed") {
      return printFailure({ command, failure: chosen.error, repoRoot: resolved.value });
    }
    switch (chosen.value) {
      case "version-1":
        return request.versionOne(command);
      case "version-2":
        return request.versionTwo(command);
      case "no-settings":
        return request.noSettings({ command, repoRoot: resolved.value });
    }
  };

export const versionChosenCommandOf = <Request extends CommandRequest>(request: VersionChoice<Request>): VersionedHandler<Request> =>
  chosenCommandOf({ ...request, noSettings: ({ command }) => request.versionTwo(command) });

export const settingsRequiringCommandOf = <Request extends CommandRequest>(request: VersionChoice<Request>): VersionedHandler<Request> =>
  chosenCommandOf({
    ...request,
    noSettings: ({ command, repoRoot }) => printFailure({ command, failure: { kind: "config-absent", repo: repoRoot }, repoRoot }),
  });

export const notReadyCommandOf =
  (request: { readonly command: Subcommand }): VersionedHandler =>
  (command) =>
    printFailure({ command, failure: { kind: "not-ready-yet", what: { thing: "command", command: request.command } }, repoRoot: undefined });
