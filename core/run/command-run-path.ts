import type { CommandRequest } from "../command-line/command-request.ts";
import type { RunLoadFailure } from "../report/run-load-failure.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import { repoArgumentOf } from "./repo-argument.ts";
import { type RunPath, runPathOf } from "./run-path.ts";

export type CommandRunPath =
  | { readonly kind: "no-repository" }
  | { readonly kind: "repository"; readonly repoRoot: AbsolutePath; readonly chosen: Result<RunPath, RunLoadFailure> };

export const commandRunPathOf = (request: { readonly command: Pick<CommandRequest, "process" | "path" | "fileText"> }): CommandRunPath => {
  const { command } = request;
  const repo = repoArgumentOf({ arguments: command.process.arguments });
  const resolved = repo === undefined ? undefined : command.path.resolve({ path: repo });
  if (resolved === undefined || resolved.outcome === "failed") {
    return { kind: "no-repository" };
  }
  return { kind: "repository", repoRoot: resolved.value, chosen: runPathOf({ fileText: command.fileText, path: command.path, repoRoot: resolved.value }) };
};
