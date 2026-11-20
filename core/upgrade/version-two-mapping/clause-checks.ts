import { catalogueOf, type RuleSetCatalogue } from "../../settings/check-choices.ts";
import { checksOf } from "../../symptom-catalogue/check-address.ts";
import type { Check } from "../../symptom-catalogue/symptom-catalogue.ts";
import type { ClauseAddress } from "../../values/clause-address.ts";

export const checksOfClause = (request: {
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly clause: ClauseAddress;
}): readonly Check[] => {
  const catalogue = catalogueOf({ catalogues: request.catalogues, ruleSet: request.clause.ruleSet });
  return catalogue === undefined ? [] : checksOf({ catalogue, clause: request.clause });
};
