import type { AttributedNativeException, ExemptedFinding, Finding } from "../governance/governance.ts";
import type { MechanismId } from "../values/identifiers.ts";
import { pathExclusionOf } from "../values/path-exclusion.ts";
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
  readonly unrunMechanisms: readonly MechanismId[];
  readonly excluded: readonly RepoPath[];
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

type Measurement = Pick<PaidDebtRequest, "unrunMechanisms" | "excluded">;

const measuredOn = (request: Measurement & { readonly mechanism: MechanismId; readonly file: RepoPath }): "measured" | "unmeasured" =>
  request.unrunMechanisms.includes(request.mechanism) || pathExclusionOf({ path: request.file, excluded: request.excluded }) === "excluded"
    ? "unmeasured"
    : "measured";

const measuredFileCarveOutPairs = (request: Measurement & { readonly records: readonly ExceptionRecord[] }): readonly DebtPair[] =>
  request.records.flatMap((record) =>
    record.kind === "file-carve-out" && measuredOn({ ...request, mechanism: record.mechanism, file: record.file }) === "measured"
      ? [{ clause: record.clause, file: record.file }]
      : [],
  );

export const paidDebtOf = (request: PaidDebtRequest): readonly DebtPair[] => {
  const held = heldPairKeys(request);
  const paidForfeits = measuredFileCarveOutPairs({ ...request, records: request.forfeited }).filter((pair) => !held.has(debtPairKey(pair)));
  return distinctDebtPairs({ pairs: [...measuredFileCarveOutPairs({ ...request, records: request.stale }), ...paidForfeits] });
};
