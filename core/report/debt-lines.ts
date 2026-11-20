import type { PaidDebt } from "../records/answering.ts";
import type { PlacedRecord } from "../records/hone-record.ts";
import { recordSubjectText, referencesText } from "./record-lines.ts";

export type PruneCommand = { readonly pruneCommand: string };

export const paidLine = (request: PruneCommand & { readonly paid: PaidDebt }): string =>
  `${recordSubjectText(request.paid.debt)}${referencesText({ lead: "answered by", records: request.paid.answeredBy })}; run ${request.pruneCommand} to remove the paid debt`;

export const staleLine = (request: PruneCommand & { readonly placed: PlacedRecord }): string => {
  const subject = recordSubjectText(request.placed);
  return request.placed.record.kind === "debt" ? `${subject}; nothing it holds is found: run ${request.pruneCommand} to remove it` : subject;
};

export const forfeitedLine = (request: PruneCommand & { readonly placed: PlacedRecord }): string =>
  `${recordSubjectText(request.placed)}; this change touched its file, so it no longer answers: fix what it held, then run ${request.pruneCommand} to remove it`;
