import type { RunnerFailure } from "../mechanism-port/runner-failure.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { LoadFailure } from "./load-failure.ts";

type ShownRequest = {
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath | undefined;
};

const NATIVE_SEPARATOR = "\\";

const SHOWN_SEPARATOR = "/";

export const shownPathOf = (request: ShownRequest & { readonly target: string }): string => {
  const location =
    request.repoRoot === undefined ? undefined : request.path.relative({ from: request.repoRoot, to: request.target });
  return location?.relation === "within-root" ? location.path : request.target.replaceAll(NATIVE_SEPARATOR, SHOWN_SEPARATOR);
};

const shownRunnerFailureOf = (request: ShownRequest & { readonly failure: RunnerFailure }): RunnerFailure => {
  const { failure } = request;
  switch (failure.kind) {
    case "piece-invalid":
      return { ...failure, pieceRoot: shownPathOf({ ...request, target: failure.pieceRoot }) };
    case "toolchain-shadowed":
      return {
        ...failure,
        location: shownPathOf({ ...request, target: failure.location }),
        installRoot: shownPathOf({ ...request, target: failure.installRoot }),
      };
    default:
      return failure;
  }
};

export const shownFailureOf = (request: ShownRequest & { readonly failure: LoadFailure }): LoadFailure => {
  const { failure } = request;
  switch (failure.kind) {
    case "file-unreadable":
    case "file-malformed":
    case "unsupported-version":
    case "rule-set-invalid":
      return { ...failure, path: shownPathOf({ ...request, target: failure.path }) };
    case "runner-failed":
      return { ...failure, failure: shownRunnerFailureOf({ ...request, failure: failure.failure }) };
    default:
      return failure;
  }
};
