import type { ProjectedFile } from "../mechanism-port/checks-runner-types.ts";
import type { ProjectionWrite } from "../mechanism-port/runner-result-schema.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { RunLoadFailure } from "../report/run-load-failure.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { gatheredOutcomes, listedOutcome } from "../values/gathered-outcomes.ts";
import type { Result } from "../values/result.ts";

type FileWrite = {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly repoRoot: AbsolutePath;
  readonly projected: ProjectedFile;
};

const existingTextOf = (request: { readonly fileText: FileTextPort; readonly location: string }): Result<string | undefined, RunLoadFailure> => {
  if (request.fileText.exists({ path: request.location }) === "absent") {
    return { outcome: "ok", value: undefined };
  }
  const read = request.fileText.read({ path: request.location });
  return read.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-unreadable", path: request.location, detail: read.error.detail } }
    : { outcome: "ok", value: read.value.replaceAll("\r\n", "\n") };
};

const writtenFileOf = (request: FileWrite): Result<ProjectionWrite, RunLoadFailure> => {
  const { projected } = request;
  const location = request.path.join({ segments: [request.repoRoot, projected.file] });
  const existing = existingTextOf({ fileText: request.fileText, location });
  if (existing.outcome === "failed") {
    return existing;
  }
  if (existing.value === projected.text) {
    return { outcome: "ok", value: { path: projected.file, effect: "unchanged" } };
  }
  const written = request.fileText.write({ path: location, text: projected.text });
  return written.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-unwritable", path: location, detail: written.error.detail } }
    : { outcome: "ok", value: { path: projected.file, effect: "written" } };
};

export const projectedFilesWrittenOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly repoRoot: AbsolutePath;
  readonly files: readonly ProjectedFile[];
}): Result<readonly ProjectionWrite[], RunLoadFailure> =>
  gatheredOutcomes({ outcomes: request.files.map((projected) => listedOutcome({ outcome: writtenFileOf({ ...request, projected }) })) });
