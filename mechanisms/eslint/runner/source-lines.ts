import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { RuleHit } from "./lint-hits.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;

export type LinesReader = (request: { readonly file: RepoPath }) => Outcome<readonly string[]>;

const LINE_BREAK = /\r\n|[\r\n\u2028\u2029]/;

export const linesReaderOf =
  (request: { readonly fileText: FileTextPort; readonly path: PathPort; readonly repoRoot: AbsolutePath }): LinesReader =>
  ({ file }) => {
    const text = request.fileText.read({ path: request.path.join({ segments: [request.repoRoot, file] }) });
    if (text.outcome === "failed") {
      return { outcome: "failed", error: { kind: "file-unreadable", file, detail: text.error.detail } };
    }
    return { outcome: "ok", value: text.value.split(LINE_BREAK) };
  };

export const sourceLinesFor = (request: {
  readonly file: RepoPath;
  readonly ruleHits: readonly RuleHit[];
  readonly readLines: LinesReader;
}): Outcome<readonly string[]> =>
  request.ruleHits.length === 0 ? { outcome: "ok", value: [] } : request.readLines({ file: request.file });
