import { assert } from "vitest";
import type { RuleSetCatalogue } from "../core/settings/check-choices.ts";
import type { Check } from "../core/symptom-catalogue/symptom-catalogue.ts";

export const shippedCheckOf = (request: { readonly catalogues: readonly RuleSetCatalogue[]; readonly discipline: string; readonly name: string }): Check => {
  const matching = request.catalogues.flatMap(({ catalogue }) =>
    catalogue.checks.filter((check) => check.name === request.name && check.clause.discipline === request.discipline),
  );
  assert(matching.length === 1, `the shipped catalogue holds exactly one ${request.name} check of ${request.discipline}`);
  return matching[0];
};
