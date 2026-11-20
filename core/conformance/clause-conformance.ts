import { loadFailureDetail } from "../command-line/load-failure-text.ts";
import { loadRunner, type RunnerLocation } from "../check/run-check.ts";
import type { Result } from "../values/result.ts";
import { boundClauseOf, type RuleSetReading } from "./clause-under-test.ts";
import { checkConformance } from "./conformance.ts";
import { editionRunsOf } from "./edition-runs.ts";
import { gatheredOutcomes } from "../values/gathered-outcomes.ts";
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
  const conformance = gatheredOutcomes({
    outcomes: await Promise.all(
      editionRunsOf(bound.value).map((run) => checkConformance({ clause: run.clause, cases: run.cases, runner: runner.value })),
    ),
  });
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
