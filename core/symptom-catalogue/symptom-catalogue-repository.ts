import type { VersionTwoLoadFailure } from "../command-line/load-failure.ts";
import type { Result } from "../values/result.ts";
import type { CatalogueHolding } from "./symptom-catalogue.ts";

export type SymptomCatalogueRepository = {
  readonly read: (request: Record<string, never>) => Result<CatalogueHolding, VersionTwoLoadFailure>;
};
