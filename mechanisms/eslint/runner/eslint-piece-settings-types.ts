import type { JsonValue } from "../../../core/values/json-value.ts";

export type RuleOptions = readonly JsonValue[];

export type EslintPieceSettings = {
  readonly pluginNamespace: string;
  readonly pluginModule: string;
  readonly rule: string;
  readonly options?: RuleOptions;
};
