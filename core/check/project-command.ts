import type { PathPort } from "../platform-ports/path-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import type { LoadFailure } from "./load-failure.ts";

const SHELL_SAFE_WORD = /^[\w./@:\\+-]+$/;

const shellWord = (request: { readonly text: string }): string =>
  SHELL_SAFE_WORD.test(request.text) ? request.text : `"${request.text}"`;

const entryFromWorkingDirectory = (request: { readonly path: PathPort; readonly entry: AbsolutePath }): string => {
  const workingDirectory = request.path.resolve({ path: "." });
  if (workingDirectory.outcome === "failed") {
    return request.entry;
  }
  const location = request.path.relative({ from: workingDirectory.value, to: request.entry });
  return location.relation === "within-root" ? location.path : request.entry;
};

export const projectCommandOf = (request: {
  readonly path: PathPort;
  readonly moduleUrl: string;
  readonly repo: string;
}): Result<string, LoadFailure> => {
  const entry = request.path.fromFileUrl({ url: request.moduleUrl });
  if (entry.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "install-root-unresolvable", url: entry.error.url, detail: entry.error.detail },
    };
  }
  const entryText = entryFromWorkingDirectory({ path: request.path, entry: entry.value });
  return {
    outcome: "ok",
    value: `node ${shellWord({ text: entryText })} project --repo ${shellWord({ text: request.repo })}`,
  };
};
