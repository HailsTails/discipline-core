import type { ChecksRunFailure as CoreChecksRunFailure, MisnamedRuleId as CoreMisnamedRuleId, NotReadyYetFailure as CoreNotReadyYetFailure } from "../core/mechanism-port/checks-runner-types.ts";
import type { ProjectionState } from "../core/mechanism-port/runner-result-schema.ts";
import type { RunLoadFailure } from "../core/report/run-load-failure.ts";
import type { Equal } from "../core/values/type-equality.ts";
import type { ChecksProjectionState, ChecksRunFailure, MisnamedRuleId, NotReadyYetFailure } from "../mechanisms/eslint/runner/checks-run-types.ts";

export const isNotReadyYetFailureAgreed: Equal<NotReadyYetFailure, CoreNotReadyYetFailure> = true;

export const isChecksRunFailureAgreed: Equal<ChecksRunFailure, CoreChecksRunFailure> = true;

export const isMisnamedRuleIdAgreed: Equal<MisnamedRuleId, CoreMisnamedRuleId> = true;

export const isProjectionStateAgreed: Equal<ChecksProjectionState, ProjectionState> = true;

export const isNotReadyYetFailureAReportedLoadFailure: NotReadyYetFailure extends Extract<RunLoadFailure, { readonly kind: "not-ready-yet" }> ? true : false = true;
