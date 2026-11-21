import type { ChecksSliceProblem } from "../../../core/mechanism-port/checks-runner-types.ts";
import type { Hit, MeasuredPair, NativeException } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { EslintConfigLookup } from "../../../core/values/eslint-config-lookup.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import type { ClauseAddress } from "../../../core/values/clause-address.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { AnsweredFile } from "./checks-projection.ts";
import type { RuledCheck } from "./check-rule-id.ts";
import type { RuleOptions } from "./eslint-piece-settings-schema.ts";
import type { ProjectedBinding } from "./projected-checks.ts";

export type ChecksRunRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly files: readonly RepoPath[];
  readonly trackedPaths: readonly RepoPath[];
  readonly checks: readonly RuledCheck[];
  readonly bindings: readonly ProjectedBinding[];
  readonly answered: readonly AnsweredFile[];
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly declaredConfigLookup: EslintConfigLookup | undefined;
};

export type SelectedCheck = {
  readonly address: string;
  readonly symptom: string;
  readonly ruleId: string;
  readonly clause: ClauseAddress;
  readonly options: RuleOptions;
};

export type MisnamedRuleId = {
  readonly kind: "version-1-id" | "names-no-check";
  readonly ruleId: string;
  readonly file: RepoPath;
  readonly line: number;
  readonly text: string;
  readonly replacedBy: readonly string[];
};

export type VersionOneRuleId = { readonly ruleId: string; readonly replacedBy: readonly string[] };

export type ChecksProjectionState = "current" | "out-of-date" | "missing" | "not-included";

export type ChecksRunReport = {
  readonly hits: readonly Hit[];
  readonly nativeExceptions: readonly NativeException[];
  readonly measured: readonly MeasuredPair[];
  readonly projection: ChecksProjectionState;
  readonly slices: readonly ChecksSliceProblem[];
  readonly misnamedRuleIds: readonly MisnamedRuleId[];
};

export type NotReadyYetFailure = {
  readonly kind: "not-ready-yet";
  readonly what: { readonly thing: "eslint-config-roots"; readonly paths: readonly string[] };
};

export type ChecksRunFailure = RunnerFailure | NotReadyYetFailure;
