import type { RunReport } from "../report/run-report.ts";
import { codePointOrder } from "./code-point-order.ts";
import type { Debt, PlacedRecord, RecordPlace } from "./hone-record.ts";

export type PrunedReason = "paid" | "stale" | "forfeited";

export type PrunableDebt = { readonly place: RecordPlace; readonly debt: Debt; readonly reason: PrunedReason };

const reasoned = (request: { readonly placed: readonly PlacedRecord[]; readonly reason: PrunedReason }): readonly PrunableDebt[] =>
  request.placed.flatMap(({ place, record }) => (record.kind === "debt" ? [{ place, debt: record, reason: request.reason }] : []));

const placeOrder = (request: { readonly left: PrunableDebt; readonly right: PrunableDebt }): number => {
  const byFile = codePointOrder({ left: request.left.place.file, right: request.right.place.file });
  return byFile === 0 ? request.left.place.index - request.right.place.index : byFile;
};

export const prunableDebtOf = (request: { readonly report: Pick<RunReport, "paid" | "stale" | "forfeited"> }): readonly PrunableDebt[] =>
  [
    ...reasoned({ placed: request.report.paid.map((paid) => paid.debt), reason: "paid" }),
    ...reasoned({ placed: request.report.stale, reason: "stale" }),
    ...reasoned({ placed: request.report.forfeited, reason: "forfeited" }),
  ].toSorted((left, right) => placeOrder({ left, right }));
