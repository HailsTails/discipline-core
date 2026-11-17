import type { AnchorKind } from "../values/anchor.ts";
import type { ClauseAddress } from "../values/clause-address-types.ts";
import type { ReadonlyJsonValue } from "../values/json-value.ts";

export type ClauseSettingValues = { readonly [key: string]: ReadonlyJsonValue };

export type RunnerClause = {
  readonly address: ClauseAddress;
  readonly anchor: AnchorKind;
  readonly pieceRoot: string;
  readonly settings: unknown;
  readonly clauseSettings: ClauseSettingValues;
};
