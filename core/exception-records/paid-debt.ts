import type { AttributedNativeException, ExemptedFinding, Finding } from "../governance/governance.ts";
import type { RepoPath } from "../values/repo-path.ts";
import { type DebtPair, debtPairKey, distinctDebtPairs } from "./debt-pair.ts";
import type { ExceptionRecord } from "./exception-record.ts";

export const PRUNE_DEBT_SUBCOMMAND = "prune-debt";

export type PaidDebtRequest = {
  readonly findings: readonly Finding[];
  readonly exempted: readonly ExemptedFinding[];
  readonly stale: readonly ExceptionRecord[];
  readonly forfeited: readonly ExceptionRecord[];
  readonly unrecorded: readonly AttributedNativeException[];
};

const nativeFileOf = (request: { readonly exception: AttributedNativeException }): RepoPath | undefined => {
  switch (request.exception.kind) {
    case "command-line-option":
      return undefined;
    case "ignore":
    case "config-override":
    case "suppression-entry":
    case "inline-disable":
    case "inline-rule-config":
      return request.exception.file;
  }
};

const heldPairKeys = (request: PaidDebtRequest): ReadonlySet<string> =>
  new Set([
    ...request.findings.map((finding) => debtPairKey(finding)),
    ...request.exempted.map((exempted) => debtPairKey(exempted.finding)),
    ...request.unrecorded.flatMap((exception) => {
      const file = nativeFileOf({ exception });
      return file === undefined ? [] : [debtPairKey({ clause: exception.clause, file })];
    }),
  ]);

const fileCarveOutPairs = (request: { readonly records: readonly ExceptionRecord[] }): readonly DebtPair[] =>
  request.records.flatMap((record) => (record.kind === "file-carve-out" ? [{ clause: record.clause, file: record.file }] : []));

export const paidDebtOf = (request: PaidDebtRequest): readonly DebtPair[] => {
  const held = heldPairKeys(request);
  const paidForfeits = fileCarveOutPairs({ records: request.forfeited }).filter((pair) => !held.has(debtPairKey(pair)));
  return distinctDebtPairs({ pairs: [...fileCarveOutPairs({ records: request.stale }), ...paidForfeits] });
};
