import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import { checksOf } from "../../symptom-catalogue/check-address.ts";
import type { Check } from "../../symptom-catalogue/symptom-catalogue.ts";
import { type ClauseAddress, TOOL_RULE_SET } from "../../values/clause-address.ts";

const ruleSetNameOf = (request: { readonly ruleSet: ClauseAddress["ruleSet"] }): string =>
  request.ruleSet === TOOL_RULE_SET ? TOOL_RULE_SET : request.ruleSet.name;

export const checksOfClause = (request: {
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly clause: ClauseAddress;
}): readonly Check[] => {
  const held = request.catalogues.find(
    ({ ruleSet }) => ruleSetNameOf({ ruleSet }) === ruleSetNameOf({ ruleSet: request.clause.ruleSet }),
  );
  return held === undefined ? [] : checksOf({ catalogue: held.catalogue, clause: request.clause });
};
