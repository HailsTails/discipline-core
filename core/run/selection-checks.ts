import type { ClauseEditionReading } from "../consumer-selection/selection.ts";
import type { CheckEdition } from "../report/run-report.ts";
import { checksOf } from "../symptom-catalogue/check-address.ts";
import type { Check, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { ClauseAddress } from "../values/clause-address.ts";

export const checksOfClauses = (request: { readonly catalogue: Pick<SymptomCatalogue, "checks">; readonly clauses: readonly ClauseAddress[] }): readonly Check[] =>
  request.clauses.flatMap((clause) => checksOf({ catalogue: request.catalogue, clause }));

export const editionsOf = (request: {
  readonly catalogue: Pick<SymptomCatalogue, "checks">;
  readonly readings: readonly ClauseEditionReading[];
}): readonly CheckEdition[] =>
  request.readings.flatMap((reading) =>
    checksOf({ catalogue: request.catalogue, clause: reading.address }).flatMap((check) =>
      check.engines
        .filter((engine) => engine.mechanism === reading.mechanism)
        .map((engine) => ({ check, engine, edition: reading.edition, latest: reading.latest })),
    ),
  );
