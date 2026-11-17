import type { PathPort } from "../platform-ports/path-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import type { LoadFailure } from "./load-failure.ts";

const SHELL_SAFE_WORD = /^[\w./@:+-]+$/;

const shellWord = (request: { readonly path: string }): string => {
  const forwardSlashed = request.path.replaceAll("\\", "/");
  return SHELL_SAFE_WORD.test(forwardSlashed) ? forwardSlashed : `"${forwardSlashed}"`;
};

export const projectCommandOf = (request: {
  readonly path: PathPort;
  readonly moduleUrl: string;
  readonly repoRoot: AbsolutePath;
}): Result<string, LoadFailure> => {
  const entry = request.path.fromFileUrl({ url: request.moduleUrl });
  if (entry.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "install-root-unresolvable", url: entry.error.url, detail: entry.error.detail },
    };
  }
  return {
    outcome: "ok",
    value: `node ${shellWord({ path: entry.value })} project --repo ${shellWord({ path: request.repoRoot })}`,
  };
};
