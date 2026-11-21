import type { Authorising } from "../records/authorising.ts";
import { type DebtOutcome, debtAddressOf } from "../records/debt-effects.ts";
import type { PrunableDebt, PrunedReason } from "../records/prunable-debt.ts";
import type { UnrecordableBecause } from "../records/unrecordable-site.ts";
import type { RepoPath } from "../values/repo-path.ts";
import { recordsFileText, refusalText } from "./record-lines.ts";

const NO_DETAIL = "";

const UNRECORDABLE_DETAIL: Readonly<Record<UnrecordableBecause, string>> = {
  "no-check": "the catalogue gives this finding no symptom or check to record debt against; fix the finding",
  ignore: "an ESLint ignore leaves the file out of the lint run, which no record can hold; remove the ignore from the ESLint configuration, or list the file in exclude in hone.config.json",
  "inline-rule-config": "a comment that sets a rule's configuration changes what the rule checks, which no record can hold; remove the comment",
  "suppression-entry": "an entry in the suppressions file hides the finding where no record can hold it; fix the code and remove the entry",
  "command-line-option": "a lint-script option weakens the script's whole run, so no record can cover it; remove it from the script",
  "config-override": "no record of this engine holds this override; fix the code, or remove the override",
  "inline-disable": "no record of this engine holds this comment; fix the code, or remove the comment",
};

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
      return UNRECORDABLE_DETAIL[outcome.because];
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
