import type { Check } from "../symptom-catalogue/symptom-catalogue.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { ClauseAddress } from "../values/clause-address-types.ts";
import type { RepoPath } from "../values/repo-path-types.ts";
import type { Result } from "../values/result.ts";
import type { RunnerFailure } from "./runner-failure.ts";
import type { Hit, MeasuredPair, NativeException, ProjectionState } from "./runner-result-schema.ts";

export type AnsweredFile = { readonly symptom: string; readonly check?: string; readonly file: RepoPath };

export type ChecksBinding = {
  readonly mechanism: string;
  readonly clause: { readonly address: ClauseAddress; readonly pieceRoot: string; readonly settings: unknown };
};

export type ChecksRunRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly files: readonly RepoPath[];
  readonly trackedPaths: readonly RepoPath[];
  readonly checks: readonly Check[];
  readonly bindings: readonly ChecksBinding[];
  readonly answered: readonly AnsweredFile[];
  readonly declaredConfigRoots: readonly RepoPath[];
};

export type MisnamedRuleIdKind = "version-1-id" | "names-no-check";

export type MisnamedRuleId = {
  readonly kind: MisnamedRuleIdKind;
  readonly ruleId: string;
  readonly file: RepoPath;
  readonly line: number;
  readonly text: string;
};

export type ChecksRunReport = {
  readonly hits: readonly Hit[];
  readonly nativeExceptions: readonly NativeException[];
  readonly measured: readonly MeasuredPair[];
  readonly projection: ProjectionState;
  readonly misnamedRuleIds: readonly MisnamedRuleId[];
};

export type NotReadyYetFailure = { readonly kind: "not-ready-yet"; readonly what: { readonly thing: "eslint-config-roots" } };

export type ChecksRunFailure = RunnerFailure | NotReadyYetFailure;

export type ChecksRunner = {
  readonly run: (request: ChecksRunRequest) => Promise<Result<ChecksRunReport, ChecksRunFailure>>;
};

export type LoadedChecksRunner = ChecksRunner & { readonly projectedKinds: readonly NativeException["kind"][] };
