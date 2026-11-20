import type { ClauseSettingValues } from "../mechanism-port/runner-module-types.ts";
import type { ClauseSettingDeclarations } from "../rule-set-reader/rule-set-reader.ts";

export const defaultClauseSettings = (request: { readonly declarations: ClauseSettingDeclarations }): ClauseSettingValues =>
  Object.fromEntries(Object.entries(request.declarations).map(([key, declaration]) => [key, declaration.default]));
