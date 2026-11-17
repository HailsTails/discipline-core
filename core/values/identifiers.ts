import { z } from "zod";
import { brandedTextSchema } from "./branded-schema.ts";
import {
  CLAUSE_ID_PATTERN,
  type ClauseId,
  DISCIPLINE_ID_PATTERN,
  type DisciplineId,
  isClauseId,
  isDisciplineId,
  isMechanismId,
  isRuleSetName,
  MECHANISM_ID_PATTERN,
  type MechanismId,
  RULE_SET_NAME_PATTERN,
  type RuleSetName,
} from "./identifier-types.ts";
import type { Equal } from "./type-equality.ts";

export type { ClauseId, DisciplineId, MechanismId, RuleSetName } from "./identifier-types.ts";

const NOT_AN_IDENTIFIER = "not an identifier of its kind";

export const ruleSetNameSchema = brandedTextSchema({
  text: z.string().regex(RULE_SET_NAME_PATTERN),
  isBranded: isRuleSetName,
  refusal: NOT_AN_IDENTIFIER,
});
export const disciplineIdSchema = brandedTextSchema({
  text: z.string().regex(DISCIPLINE_ID_PATTERN),
  isBranded: isDisciplineId,
  refusal: NOT_AN_IDENTIFIER,
});
export const clauseIdSchema = brandedTextSchema({
  text: z.string().regex(CLAUSE_ID_PATTERN),
  isBranded: isClauseId,
  refusal: NOT_AN_IDENTIFIER,
});
export const mechanismIdSchema = brandedTextSchema({
  text: z.string().regex(MECHANISM_ID_PATTERN),
  isBranded: isMechanismId,
  refusal: NOT_AN_IDENTIFIER,
});

export const isRuleSetNameSchemaEqual: Equal<z.output<typeof ruleSetNameSchema>, RuleSetName> = true;
export const isDisciplineIdSchemaEqual: Equal<z.output<typeof disciplineIdSchema>, DisciplineId> = true;
export const isClauseIdSchemaEqual: Equal<z.output<typeof clauseIdSchema>, ClauseId> = true;
export const isMechanismIdSchemaEqual: Equal<z.output<typeof mechanismIdSchema>, MechanismId> = true;
