import type { LoadFailure } from "../check/load-failure.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { readVersionOneJson } from "../rule-set-reader/rule-set-reader.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import { EMPTY_SYMPTOM_CATALOGUE, type SymptomCatalogue } from "./symptom-catalogue.ts";
import type { SymptomCatalogueRepository } from "./symptom-catalogue-repository.ts";
import { symptomCatalogueOf } from "./symptom-catalogue-wire.ts";

export const SYMPTOM_CATALOGUE_SEGMENTS: readonly string[] = ["rules", "typescript", "symptoms.json"];

type CatalogueSource = {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly ruleSetRoot: AbsolutePath;
};

const readSymptomCatalogue = (request: CatalogueSource): Result<SymptomCatalogue, LoadFailure> => {
  const path = request.path.join({ segments: [request.ruleSetRoot, ...SYMPTOM_CATALOGUE_SEGMENTS] });
  if (request.fileText.exists({ path }) === "absent") {
    return { outcome: "ok", value: EMPTY_SYMPTOM_CATALOGUE };
  }
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const catalogue = symptomCatalogueOf({ document: document.value });
  return catalogue.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-malformed", path, detail: catalogue.error } }
    : catalogue;
};

export const createSymptomCatalogueRepository = (options: CatalogueSource): SymptomCatalogueRepository => ({
  read: (_request) => readSymptomCatalogue(options),
});
