import type { ClauseId, DisciplineId, RuleSetName } from "./identifier-types.ts";
import type { TOOL_IDENTITY } from "./tool-identity.ts";

export type ClauseAddress = {
  readonly ruleSet: typeof TOOL_IDENTITY.ownRuleSet | { readonly name: RuleSetName };
  readonly discipline: DisciplineId;
  readonly clause: ClauseId;
};
