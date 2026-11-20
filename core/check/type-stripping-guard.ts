import { readEslintProjection } from "../consumer-selection/consumer-selection.ts";
import type { TypeStrippingPort } from "../platform-ports/type-stripping-port.ts";
import type { EslintProjection } from "../values/eslint-projection.ts";
import { repoRootOf } from "./check-locations.ts";
import { parseCheckArguments } from "./command-arguments.ts";
import { loadFailureOutcome } from "./command-outcome.ts";
import type { LoadFailure } from "./load-failure.ts";
import { type CommandRequest, printOutcome } from "./run-check-command.ts";

type GuardedHandler = (request: CommandRequest) => Promise<void>;

const chosenProjectionOf = (request: { readonly command: CommandRequest }): EslintProjection | undefined => {
  const parsed = parseCheckArguments({ arguments: request.command.process.arguments });
  if (parsed.outcome === "failed") {
    return undefined;
  }
  const repoRoot = repoRootOf({ path: request.command.path, fileText: request.command.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return undefined;
  }
  const chosen = readEslintProjection({ fileText: request.command.fileText, path: request.command.path, repoRoot: repoRoot.value });
  return chosen.outcome === "failed" ? undefined : chosen.value;
};

export const projectionRefusalOf = (request: {
  readonly eslintProjection: EslintProjection | undefined;
  readonly typeStripping: TypeStrippingPort;
}): LoadFailure | undefined =>
  request.eslintProjection === "typescript" && request.typeStripping.state({}) === "keeps-types"
    ? { kind: "projection-needs-type-stripping" }
    : undefined;

export const typeStrippingGuarded =
  (request: { readonly handler: GuardedHandler; readonly typeStripping: TypeStrippingPort }): GuardedHandler =>
  (command) => {
    const refusal = projectionRefusalOf({ eslintProjection: chosenProjectionOf({ command }), typeStripping: request.typeStripping });
    if (refusal === undefined) {
      return request.handler(command);
    }
    printOutcome({ process: command.process, outcome: loadFailureOutcome({ failure: refusal }) });
    return Promise.resolve();
  };
