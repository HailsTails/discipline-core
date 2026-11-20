import type { VersionTwoLoadFailure } from "../command-line/load-failure.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { RunLoadFailure } from "../report/run-load-failure.ts";
import { createSymptomCatalogueRepository, SYMPTOM_CATALOGUE_SEGMENTS } from "../symptom-catalogue/read-symptom-catalogue.ts";
import type { SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";

const unreadDetailOf = (request: { readonly error: VersionTwoLoadFailure }): string => {
  const { error } = request;
  return error.kind === "file-unreadable" || error.kind === "file-malformed" ? error.detail : error.kind;
};

export const toolCatalogueOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly installRoot: AbsolutePath;
}): Result<SymptomCatalogue, RunLoadFailure> => {
  const path = request.path.join({ segments: [request.installRoot, ...SYMPTOM_CATALOGUE_SEGMENTS] });
  const held = createSymptomCatalogueRepository({ fileText: request.fileText, path: request.path, ruleSetRoot: request.installRoot }).read({});
  if (held.outcome === "failed") {
    return { outcome: "failed", error: { kind: "catalogue-not-read", path, reason: { reason: "unreadable", detail: unreadDetailOf({ error: held.error }) } } };
  }
  return held.value.held === "catalogue"
    ? { outcome: "ok", value: held.value.catalogue }
    : { outcome: "failed", error: { kind: "catalogue-not-read", path, reason: { reason: "absent" } } };
};
