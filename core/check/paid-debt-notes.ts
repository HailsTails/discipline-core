import { debtPairKey } from "../exception-records/debt-pair.ts";
import { paidDebtOf } from "../exception-records/paid-debt.ts";
import type { GovernanceResult } from "../governance/governance.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { PaidDebtNote } from "../verdict/check-report.ts";
import type { MechanismRun } from "./mechanism-dispatch.ts";

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
  readonly runs: readonly Pick<MechanismRun, "mechanism" | "projection">[];
}): readonly PaidDebtNote[] => {
  const paid = paidDebtOf(request.governed);
  if (paid.length === 0) {
    return [];
  }
  const paidMechanisms = paidMechanismsOf({ governed: request.governed, paidKeys: new Set(paid.map((pair) => debtPairKey(pair))) });
  const projections = request.runs.flatMap((run) =>
    run.projection !== "none" && paidMechanisms.has(run.mechanism) ? [run.mechanism] : [],
  );
  return [{ kind: "paid-debt", fileCarveOuts: paid.length, projections }];
};
