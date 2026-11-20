import type { Authorising } from "../records/authorising.ts";
import { type DebtOutcome, debtAddressOf } from "../records/debt-effects.ts";
import type { PrunableDebt } from "../records/prunable-debt.ts";
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
    case "new-file":
      return "the base revision does not hold this file, so its debt was not inherited; fix it, or record it as an authorised location";
    case "touched":
      return "this change changed the file, so debt on it would be forfeited by the same run; fix the finding here, or record it as an authorised location";
  }
};

const withDetail = (request: { readonly head: string; readonly detail: string }): string => (request.detail === NO_DETAIL ? request.head : `${request.head}: ${request.detail}`);

export const debtOutcomeLine = (request: { readonly outcome: DebtOutcome }): string =>
  withDetail({ head: `${request.outcome.address} ${request.outcome.effect} ${request.outcome.file}`, detail: detailOf(request) });

export const prunedDebtLine = (request: { readonly pruned: PrunableDebt }): string =>
  `${debtAddressOf({ debt: request.pruned.debt })} removed ${request.pruned.debt.file}: ${request.pruned.reason}`;

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
