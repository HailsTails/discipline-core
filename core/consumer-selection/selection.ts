import type { AbsolutePath } from "../values/absolute-path.ts";
import type { RunnerClause } from "../mechanism-port/runner-module-schema.ts";
import type { ClauseAddress } from "../values/clause-address.ts";
import type { FileExceptionWhyChains } from "../values/file-exception-why-chains.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { ClauseExceptions } from "../rule-set-reader/rule-set-reader.ts";

export type SelectedClause = {
  readonly address: ClauseAddress;
  readonly mechanism: MechanismId;
  readonly exceptions: ClauseExceptions;
};

export type Selection = {
  readonly selected: readonly SelectedClause[];
  readonly uncovered: readonly ClauseAddress[];
  readonly notAdopted: readonly ClauseAddress[];
  readonly notRun: readonly ClauseAddress[];
};

export type ClauseRoot = {
  readonly clause: ClauseAddress;
  readonly ruleSetRoot: AbsolutePath;
};

export type ClauseBinding = {
  readonly mechanism: MechanismId;
  readonly clause: RunnerClause;
};

export type SelectionReading = {
  readonly selection: Selection;
  readonly bindings: readonly ClauseBinding[];
  readonly clauseRoots: readonly ClauseRoot[];
  readonly excluded: readonly RepoPath[];
  readonly eslintConfigRoots: readonly RepoPath[];
  readonly fileExceptionWhyChains: FileExceptionWhyChains;
};
