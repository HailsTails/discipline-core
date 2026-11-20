import type { LoadFailure } from "../command-line/load-failure.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { readVersionOneJson } from "../rule-set-reader/rule-set-reader.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import { type ConsumerSelectionFile, selectionFileOf } from "./selection-file.ts";

export const selectionFilePathOf = (request: { readonly path: PathPort; readonly repoRoot: AbsolutePath }): string =>
  request.path.join({ segments: [request.repoRoot, "disciplines.json"] });

export const readSelectionFile = (request: {
  readonly fileText: FileTextPort;
  readonly path: string;
}): Result<ConsumerSelectionFile, LoadFailure> => {
  const document = readVersionOneJson(request);
  return document.outcome === "failed" ? document : selectionFileOf({ document: document.value, path: request.path });
};
