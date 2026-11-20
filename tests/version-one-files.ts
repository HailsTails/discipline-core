import type { ReadonlyJsonValue } from "../core/values/json-value.ts";

const VERSION_ONE = 1;

const JSON_INDENT = 2;

export const selectionTextOf = (request: { readonly clauses: Readonly<Record<string, string>> }): string =>
  `${JSON.stringify({ version: VERSION_ONE, ruleSets: {}, clauses: request.clauses }, null, JSON_INDENT)}\n`;

export const exceptionsTextOf = (request: { readonly exceptions: readonly ReadonlyJsonValue[] }): string =>
  `${JSON.stringify({ version: VERSION_ONE, exceptions: request.exceptions }, null, JSON_INDENT)}\n`;
