import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import { argumentsInvalid } from "./argument-problem.ts";
import { type CheckArguments, parseCheckArguments } from "./command-arguments.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "./load-failure.ts";

const SELECTION_FILE_NAME = "disciplines.json";

export type CheckLocations = {
  readonly arguments: CheckArguments;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
};

export const repoRootOf = (request: {
  readonly path: PathPort;
  readonly fileText: Pick<FileTextPort, "exists">;
  readonly repo: string;
}): Result<AbsolutePath, LoadFailure> => {
  const resolved = request.path.resolve({ path: request.repo });
  if (resolved.outcome === "failed") {
    return argumentsInvalid({ problem: { kind: "repo-unresolvable", given: request.repo } });
  }
  const selection = request.path.join({ segments: [resolved.value, SELECTION_FILE_NAME] });
  return request.fileText.exists({ path: selection }) === "absent"
    ? { outcome: "failed", error: { kind: "selection-absent", repo: request.repo } }
    : resolved;
};

export const checkLocationsFor = (request: {
  readonly arguments: readonly string[];
  readonly path: PathPort;
  readonly fileText: Pick<FileTextPort, "exists">;
  readonly moduleUrl: string;
}): Result<CheckLocations, LoadFailure> => {
  const parsed = parseCheckArguments({ arguments: request.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const repoRoot = repoRootOf({ path: request.path, fileText: request.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  return installRoot.outcome === "failed"
    ? installRoot
    : { outcome: "ok", value: { arguments: parsed.value, repoRoot: repoRoot.value, installRoot: installRoot.value } };
};
