import type { ClauseAddress } from "../values/clause-address-types.ts";

export type ConformanceFailure = {
  readonly clause: ClauseAddress;
  readonly caseName: string;
  readonly expectedLines: readonly number[];
  readonly flaggedLines: readonly number[];
};
