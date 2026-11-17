import type { AnchorKind } from "../values/anchor.ts";
import type { ClauseAddress } from "../values/clause-address-types.ts";

export type RunnerClause = {
  readonly address: ClauseAddress;
  readonly anchor: AnchorKind;
  readonly pieceRoot: string;
  readonly settings: unknown;
};
