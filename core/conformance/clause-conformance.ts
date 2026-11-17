import { loadFailureDetail } from "../check/load-failure-text.ts";
import { loadRunner, type RunnerLocation } from "../check/run-check.ts";
import type { Result } from "../values/result.ts";
import { boundClauseOf, type RuleSetReading } from "./clause-under-test.ts";
import { checkConformance } from "./conformance.ts";
import type { ClauseRequest, ConformanceFailure, ConformanceSetupFailure } from "./conformance-testing-types.ts";

export type ClauseConformanceRequest = RuleSetReading & Omit<RunnerLocation, "mechanism" | "path"> & ClauseRequest;

export const clauseConformanceOf = async (
  request: ClauseConformanceRequest,
): Promise<Result<readonly ConformanceFailure[], ConformanceSetupFailure>> => {
  const bound = boundClauseOf(request);
  if (bound.outcome === "failed") {
    return bound;
  }
  const runner = await loadRunner(request);
  if (runner.outcome === "failed") {
    return { outcome: "failed", error: { kind: "runner-unloadable", detail: loadFailureDetail({ failure: runner.error }) } };
  }
  const conformance = await checkConformance({ clause: bound.value.clause, cases: bound.value.cases, runner: runner.value });
  return conformance.outcome === "failed"
    ? {
        outcome: "failed",
        error: {
          kind: "runner-refused",
          detail: loadFailureDetail({ failure: { kind: "runner-failed", mechanism: request.mechanism, failure: conformance.error } }),
        },
      }
    : conformance;
};
