import type { Branded } from "./branded.ts";

export type RuleSetName = Branded<string, "RuleSetName">;
export type DisciplineId = Branded<string, "DisciplineId">;
export type ClauseId = Branded<string, "ClauseId">;
export type MechanismId = Branded<string, "MechanismId">;

export const RULE_SET_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
export const DISCIPLINE_ID_PATTERN = /^[A-Z]{2,4}-[0-9]+[a-z]?$/;
export const CLAUSE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
export const MECHANISM_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export const isRuleSetName = (text: string): text is RuleSetName => RULE_SET_NAME_PATTERN.test(text);
export const isDisciplineId = (text: string): text is DisciplineId => DISCIPLINE_ID_PATTERN.test(text);
export const isClauseId = (text: string): text is ClauseId => CLAUSE_ID_PATTERN.test(text);
export const isMechanismId = (text: string): text is MechanismId => MECHANISM_ID_PATTERN.test(text);
