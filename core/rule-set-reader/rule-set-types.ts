import type { AnchorKind } from "../values/anchor.ts";
import type { ClauseExceptions } from "./authored-rule-set-types.ts";
import type { ClauseId, DisciplineId, MechanismId } from "../values/identifier-types.ts";
import type { RepoPath } from "../values/repo-path-types.ts";

export type SourceCase = {
  readonly name: string;
  readonly fileName: RepoPath;
  readonly source: string;
  readonly expectedLines: readonly number[];
};

export type { ClauseExceptions } from "./authored-rule-set-types.ts";

export type ClauseDefinition =
  | {
      readonly kind: "mechanical";
      readonly id: ClauseId;
      readonly summary: string;
      readonly mechanisms: readonly MechanismId[];
      readonly anchor: AnchorKind;
      readonly exceptions: ClauseExceptions;
      readonly cases: {
        readonly flag: readonly SourceCase[];
        readonly allow: readonly SourceCase[];
      };
    }
  | {
      readonly kind: "judgement";
      readonly id: ClauseId;
      readonly summary: string;
      readonly enforcedBy: "review";
    };

export type DisciplineFile = {
  readonly version: 1;
  readonly id: DisciplineId;
  readonly clauses: readonly ClauseDefinition[];
};

export type PieceFile = {
  readonly version: 1;
  readonly discipline: DisciplineId;
  readonly mechanism: MechanismId;
  readonly clauses: readonly {
    readonly clause: ClauseId;
    readonly settings: unknown;
  }[];
};
