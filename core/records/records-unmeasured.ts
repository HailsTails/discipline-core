import type { TouchedSet } from "../touched-set/touched-set.ts";
import type { BaseRevisionAvailability } from "../values/base-revision-availability.ts";
import type { BaseMeasurement, PlacedRecord } from "./hone-record.ts";
import { carriedListingOf } from "./records-reading.ts";

export type RecordsUnmeasured = { readonly kind: "forfeiture-unmeasured" | "import-unmeasured"; readonly base: BaseRevisionAvailability };

const forfeitureUnmeasured = (request: { readonly records: readonly PlacedRecord[]; readonly touched: TouchedSet }): readonly RecordsUnmeasured[] =>
  request.touched.measured === "no" && request.records.some((placed) => placed.record.kind === "debt")
    ? [{ kind: "forfeiture-unmeasured", base: request.touched.base }]
    : [];

const importUnmeasured = (request: { readonly records: readonly PlacedRecord[]; readonly base: BaseMeasurement }): readonly RecordsUnmeasured[] =>
  request.base.measured === "no" && carriedListingOf({ records: request.records }).length > 0 ? [{ kind: "import-unmeasured", base: request.base.base }] : [];

export const recordsUnmeasuredOf = (request: {
  readonly records: readonly PlacedRecord[];
  readonly base: BaseMeasurement;
  readonly touched: TouchedSet;
}): readonly RecordsUnmeasured[] => [...forfeitureUnmeasured(request), ...importUnmeasured(request)];
