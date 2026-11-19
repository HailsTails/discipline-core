import type { DebtPair } from "../exception-records/debt-pair.ts";
import { debtPairKey } from "../exception-records/debt-pair.ts";
import { type PaidDebtRequest, paidDebtOf } from "../exception-records/paid-debt.ts";
import type { GovernanceResult } from "../governance/governance.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { PaidDebtNote, Unmeasured } from "../verdict/check-report.ts";
import type { MechanismRun } from "./mechanism-dispatch.ts";

export type ReportedDebt = Omit<PaidDebtRequest, "unrunMechanisms"> & { readonly unmeasured: readonly Unmeasured[] };

const unrunMechanismsOf = (request: { readonly unmeasured: readonly Unmeasured[] }): readonly MechanismId[] =>
  request.unmeasured.flatMap((entry) => (entry.kind === "mechanism-not-run" ? [entry.mechanism] : []));

export const reportedPaidDebtOf = (request: ReportedDebt): readonly DebtPair[] =>
  paidDebtOf({ ...request, unrunMechanisms: unrunMechanismsOf(request) });

const paidMechanismsOf = (request: {
  readonly governed: GovernanceResult;
  readonly paidKeys: ReadonlySet<string>;
}): ReadonlySet<MechanismId> =>
  new Set(
    [...request.governed.stale, ...request.governed.forfeited].flatMap((record) =>
      record.kind === "file-carve-out" && request.paidKeys.has(debtPairKey(record)) ? [record.mechanism] : [],
    ),
  );

export const paidDebtNotesOf = (request: {
  readonly governed: GovernanceResult;
  readonly unmeasured: readonly Unmeasured[];
  readonly excluded: readonly RepoPath[];
  readonly runs: readonly Pick<MechanismRun, "mechanism" | "projection">[];
}): readonly PaidDebtNote[] => {
  const paid = reportedPaidDebtOf({ ...request.governed, unmeasured: request.unmeasured, excluded: request.excluded });
  if (paid.length === 0) {
    return [];
  }
  const paidMechanisms = paidMechanismsOf({ governed: request.governed, paidKeys: new Set(paid.map((pair) => debtPairKey(pair))) });
  const projections = request.runs.flatMap((run) =>
    run.projection !== "none" && paidMechanisms.has(run.mechanism) ? [run.mechanism] : [],
  );
  return [{ kind: "paid-debt", fileCarveOuts: paid.length, projections }];
};
