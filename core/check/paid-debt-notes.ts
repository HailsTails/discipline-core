import { type DebtPair, debtPairKey } from "../upgrade/version-one-records/debt-pair.ts";
import type { GovernanceResult } from "../upgrade/answering/governance.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { PaidDebtNote } from "../verdict/check-report.ts";
import type { MechanismRun } from "../run/mechanism-dispatch.ts";

type GovernedRecords = Pick<GovernanceResult, "stale" | "forfeited">;

const paidMechanismsOf = (request: {
  readonly governed: GovernedRecords;
  readonly paidKeys: ReadonlySet<string>;
}): ReadonlySet<MechanismId> =>
  new Set(
    [...request.governed.stale, ...request.governed.forfeited].flatMap((record) =>
      record.kind === "file-carve-out" && request.paidKeys.has(debtPairKey(record)) ? [record.mechanism] : [],
    ),
  );

export const paidDebtNotesOf = (request: {
  readonly governed: GovernedRecords;
  readonly paid: readonly DebtPair[];
  readonly runs: readonly Pick<MechanismRun, "mechanism" | "projection">[];
}): readonly PaidDebtNote[] => {
  if (request.paid.length === 0) {
    return [];
  }
  const paidMechanisms = paidMechanismsOf({ governed: request.governed, paidKeys: new Set(request.paid.map((pair) => debtPairKey(pair))) });
  const projections = request.runs.flatMap((run) =>
    run.projection !== "none" && paidMechanisms.has(run.mechanism) ? [run.mechanism] : [],
  );
  return [{ kind: "paid-debt", fileCarveOuts: request.paid.length, projections }];
};
