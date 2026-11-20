import { type CheckRequest, findingsOf, loadInputs, mechanismRuns, treeOf } from "../../check/run-check.ts";
import { loadFailureDetail } from "../../command-line/load-failure-text.ts";
import type { LoadFailure } from "../../command-line/load-failure.ts";
import type { Result } from "../../values/result.ts";
import type { EngineFindings, EnginePass, EnginePassFailure } from "../carve-out-oracle/answering-oracle.ts";
import { UNMEASURED_EXCEPTION_BASELINE } from "../version-one-records/exception-records.ts";

const failureOf = (request: { readonly failure: LoadFailure }): Result<EngineFindings, EnginePassFailure> => ({
  outcome: "failed",
  error: { kind: "version-one-run-failed", detail: loadFailureDetail({ failure: request.failure }) },
});

export const createVersionOneEnginePass = (request: { readonly check: CheckRequest }): EnginePass => ({
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
    return runs.outcome === "failed" ? failureOf({ failure: runs.error }) : { outcome: "ok", value: { findings: findingsOf({ runs: runs.value }), runs: runs.value } };
  },
});
