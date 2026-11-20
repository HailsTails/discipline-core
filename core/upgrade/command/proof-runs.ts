import { loadFailureDetail } from "../../command-line/load-failure-text.ts";
import type { LoadFailure } from "../../command-line/load-failure.ts";
import { runLoadFailureLine } from "../../report/load-failure-lines.ts";
import type { RunLoadFailure } from "../../report/run-load-failure.ts";
import type { RunReport } from "../../report/run-report.ts";
import type { Result } from "../../values/result.ts";
import type { CheckReport } from "../../verdict/check-report.ts";
import type { ProofRunFailure, ProofRuns } from "../proof/upgrade-proof.ts";

export type ProofRunSources = {
  readonly versionOne: () => Promise<Result<CheckReport, LoadFailure>>;
  readonly versionTwo: () => Promise<Result<{ readonly report: RunReport }, RunLoadFailure>>;
};

const failedWith = (request: { readonly detail: string }): Result<never, ProofRunFailure> => ({
  outcome: "failed",
  error: { kind: "run-failed", detail: request.detail },
});

export const proofRunsOf = (request: ProofRunSources): ProofRuns => ({
  versionOne: async () => {
    const run = await request.versionOne();
    return run.outcome === "failed" ? failedWith({ detail: loadFailureDetail({ failure: run.error }) }) : run;
  },
  versionTwo: async () => {
    const run = await request.versionTwo();
    return run.outcome === "failed"
      ? failedWith({ detail: runLoadFailureLine({ failure: run.error, upgradeCommand: undefined }) })
      : { outcome: "ok", value: run.value.report };
  },
});
