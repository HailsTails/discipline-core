import type { Authorising } from "../records/authorising.ts";
import { type DebtOutcome, debtAddressOf } from "../records/debt-effects.ts";
import type { PrunableDebt, PrunedReason } from "../records/prunable-debt.ts";
import type { RepoPath } from "../values/repo-path.ts";
import { recordsFileText, refusalText } from "./record-lines.ts";

const NO_DETAIL = "";

const detailOf = (request: { readonly outcome: DebtOutcome }): string => {
  const { outcome } = request;
  switch (outcome.effect) {
    case "recorded":
      return NO_DETAIL;
    case "already-recorded":
      return `${recordsFileText({ file: outcome.heldIn })} already holds debt on this symptom and file; the check says why it does not answer`;
    case "left":
      return `under --leave ${outcome.under}; record it as an authorised location with its own reason, or fix it`;
    case "touched":
      return "this change created or changed the file, so this run would forfeit debt on it; fix the finding there";
    case "unrecordable":
      return "the catalogue gives this finding no symptom or check to record debt against; fix the finding";
  }
};

const withDetail = (request: { readonly head: string; readonly detail: string }): string => (request.detail === NO_DETAIL ? request.head : `${request.head}: ${request.detail}`);

export const debtOutcomeLine = (request: { readonly outcome: DebtOutcome }): string =>
  withDetail({ head: `${request.outcome.address} ${request.outcome.effect} ${request.outcome.file}`, detail: detailOf(request) });

const PRUNED_REASON_TEXT: Readonly<Record<PrunedReason, string>> = {
  paid: "paid",
  forfeited: "forfeited",
  "credited-nothing": "stale",
  "file-gone": "stale, its file is no longer in the repository",
  "file-excluded": "stale, its file is excluded by the settings",
};

export const prunedDebtLine = (request: { readonly pruned: PrunableDebt }): string =>
  `${debtAddressOf({ debt: request.pruned.debt })} removed ${request.pruned.debt.file}: ${PRUNED_REASON_TEXT[request.pruned.reason]}`;

export const authorisingLines = (request: { readonly address: string; readonly file: RepoPath; readonly authorising: Authorising }): readonly string[] => {
  const { address, file, authorising } = request;
  switch (authorising.judged) {
    case "accepted":
      return [`${address} authorised ${file}`];
    case "already-held":
      return [`${address} already-authorised ${file}: ${recordsFileText({ file: authorising.heldIn })} already holds this record`];
    case "refused":
      return authorising.refusals.map((refusal) => `${address} refused ${file}: ${refusalText({ refusal })}`);
  }
};
