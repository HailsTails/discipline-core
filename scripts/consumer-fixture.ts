import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { Result } from "../core/values/result.ts";
import type { ListedEntry, ScratchFilesPort } from "./install-proof-ports.ts";

export const CONSUMER_FIXTURE_SUFFIX = ".fixture";

const SUCCEEDED: Result<null, string> = { outcome: "ok", value: null };

export const materialisedPathOf = (request: { readonly path: string }): Result<string, string> =>
  request.path.endsWith(CONSUMER_FIXTURE_SUFFIX)
    ? { outcome: "ok", value: request.path.slice(0, -CONSUMER_FIXTURE_SUFFIX.length) }
    : {
        outcome: "failed",
        error: `${request.path} does not end in ${CONSUMER_FIXTURE_SUFFIX}: a consumer fixture holds another repository's files, which this repository must not check as its own`,
      };

export type MaterialiseRequest = {
  readonly scratch: ScratchFilesPort;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly from: string;
  readonly to: string;
};

type FixtureFile = { readonly source: string; readonly target: string };

const fixtureFilesOf = (request: { readonly entries: readonly ListedEntry[] }): Result<readonly FixtureFile[], string> => {
  const files = request.entries.filter((entry) => entry.entryKind === "file");
  const refused = files.flatMap((entry) => {
    const target = materialisedPathOf({ path: entry.path });
    return target.outcome === "failed" ? [target.error] : [];
  });
  return refused.length > 0
    ? { outcome: "failed", error: refused.join("; ") }
    : { outcome: "ok", value: files.map((entry) => ({ source: entry.path, target: entry.path.slice(0, -CONSUMER_FIXTURE_SUFFIX.length) })) };
};

const materialisedFile = (request: MaterialiseRequest & { readonly file: FixtureFile }): Result<null, string> => {
  const text = request.fileText.read({ path: request.path.join({ segments: [request.from, request.file.source] }) });
  if (text.outcome === "failed") {
    return { outcome: "failed", error: text.error.detail };
  }
  const destination = request.path.join({ segments: [request.to, request.file.target] });
  const folder = request.scratch.makeDirectory({ path: request.path.directoryOf({ path: destination }) });
  if (folder.outcome === "failed") {
    return { outcome: "failed", error: folder.error.detail };
  }
  const written = request.fileText.write({ path: destination, text: text.value });
  return written.outcome === "failed" ? { outcome: "failed", error: written.error.detail } : SUCCEEDED;
};

export const materialisedConsumer = (request: MaterialiseRequest): Result<null, string> => {
  const listed = request.scratch.listTree({ path: request.from });
  if (listed.outcome === "failed") {
    return { outcome: "failed", error: listed.error.detail };
  }
  const files = fixtureFilesOf({ entries: listed.value });
  return files.outcome === "failed"
    ? files
    : files.value.reduce<Result<null, string>>(
        (sofar, file) => (sofar.outcome === "failed" ? sofar : materialisedFile({ ...request, file })),
        SUCCEEDED,
      );
};
