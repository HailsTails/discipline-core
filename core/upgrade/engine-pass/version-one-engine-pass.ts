import { type CheckRequest, findingsOf, loadInputs, mechanismRuns, projectionOutcome, treeOf } from "../../check/run-check.ts";
import { loadFailureDetail } from "../../command-line/load-failure-text.ts";
import type { LoadFailure } from "../../command-line/load-failure.ts";
import type { MechanismRun } from "../../run/mechanism-dispatch.ts";
import type { Result } from "../../values/result.ts";
import type { EngineFindings, EnginePass, EnginePassFailure } from "../carve-out-oracle/answering-oracle.ts";
import { UNMEASURED_EXCEPTION_BASELINE } from "../version-one-records/exception-records.ts";

const failureOf = (request: { readonly failure: LoadFailure }): Result<EngineFindings, EnginePassFailure> => ({
  outcome: "failed",
  error: { kind: "version-one-run-failed", detail: loadFailureDetail({ failure: request.failure }) },
});

const projectionFailureOf = (request: { readonly runs: readonly MechanismRun[] }): EnginePassFailure | undefined => {
  const outcomes = request.runs.map((run) => projectionOutcome({ run }));
  const notRun = outcomes.flatMap((outcome) => outcome.unmeasured).find((unmeasured) => unmeasured.kind === "mechanism-not-run");
  if (notRun?.kind === "mechanism-not-run") {
    return { kind: "version-one-run-failed", detail: `${notRun.mechanism} not run: its projection is ${notRun.projection}` };
  }
  const problem = outcomes.flatMap((outcome) => outcome.problems)[0];
  return problem === undefined ? undefined : { kind: "version-one-run-failed", detail: `${problem.mechanism} projection is ${problem.state}` };
};

export const createVersionOneEnginePass =(request: { readonly check: CheckRequest }): EnginePass => ({
  findingsFor: async ({ records }) => {
    const { check } = request;
    const inputs = await loadInputs({ ...check, exceptionBaselineOf: () => UNMEASURED_EXCEPTION_BASELINE });
    if (inputs.outcome === "failed") {
      return failureOf({ failure: inputs.error });
    }
    const tree = treeOf({ check, inputs: inputs.value });
    if (tree.outcome === "failed") {
      return failureOf({ failure: tree.error });
    }
    const runs = await mechanismRuns({ check, tree: tree.value, inputs: { ...inputs.value, records } });
    if (runs.outcome === "failed") {
      return failureOf({ failure: runs.error });
    }
    const projectionFailure = projectionFailureOf({ runs: runs.value });
    return projectionFailure === undefined
      ? { outcome: "ok", value: { findings: findingsOf({ runs: runs.value }), runs: runs.value } }
      : { outcome: "failed", error: projectionFailure };
  },
});
