import type { LoadFailure } from "../check/load-failure.ts";
import type { Result } from "../values/result.ts";
import type { SymptomCatalogue } from "./symptom-catalogue.ts";

export type SymptomCatalogueRepository = {
  readonly read: (request: Record<string, never>) => Result<SymptomCatalogue, LoadFailure>;
};
