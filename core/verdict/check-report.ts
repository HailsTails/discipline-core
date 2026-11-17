import type {
  ExceptionRecord,
  InvalidRecord,
} from "../exception-records/exception-records.ts";
import type {
  AttributedNativeException,
  DoublyHeld,
  ExemptedFinding,
  Finding,
} from "../governance/governance.ts";
import type { ClauseAddress } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { RepoPath } from "../values/repo-path.ts";

export type Unmeasured =
  | { readonly kind: "forfeiture-unmeasured" }
  | { readonly kind: "import-unmeasured" }
  | { readonly kind: "legacy-chain-unmeasured" }
  | {
      readonly kind: "mechanism-not-run";
      readonly mechanism: MechanismId;
      readonly projection: "missing" | "not-included";
    };

export type NotRunClause = {
  readonly clause: ClauseAddress;
  readonly mechanism: MechanismId;
};


export type PartialAssessment =
  | {
      readonly concern: "forfeiture";
      readonly assessedBy: "elsewhere";
      readonly fileCarveOuts: number;
    }
  | {
      readonly concern: "waivedClauses";
      readonly assessedBy: "not-run";
      readonly clausesNotRun: readonly NotRunClause[];
      readonly recordsNotJudgedStale: number;
    };

export type ProjectionProblem =
  | { readonly mechanism: MechanismId; readonly state: "out-of-date" }
  | {
      readonly mechanism: MechanismId;
      readonly state: "out-of-date" | "missing" | "not-applied";
      readonly slice: RepoPath;
    };

export type CheckReport = {
  readonly excluded: readonly RepoPath[];
  readonly notAdopted: readonly ClauseAddress[];
  readonly findings: readonly Finding[];
  readonly exempted: readonly ExemptedFinding[];
  readonly uncovered: readonly ClauseAddress[];
  readonly stale: readonly ExceptionRecord[];
  readonly forfeited: readonly ExceptionRecord[];
  readonly unrecorded: readonly AttributedNativeException[];
  readonly doublyHeld: readonly DoublyHeld[];
  readonly invalidRecords: readonly InvalidRecord[];
  readonly unmeasured: readonly Unmeasured[];
  readonly projectionProblems: readonly ProjectionProblem[];
  readonly assessment: readonly PartialAssessment[];
};
