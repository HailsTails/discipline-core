import type { CommandOutcome } from "../check/command-outcome.ts";
import { runLoadFailureLine } from "../report/load-failure-lines.ts";
import type { RunLoadFailure } from "../report/run-load-failure.ts";

const LOAD_FAILURE_CODE = 2;

export const runLoadFailureOutcomeOf = (request: { readonly failure: RunLoadFailure }): CommandOutcome => ({
  code: LOAD_FAILURE_CODE,
  text: `${runLoadFailureLine({ failure: request.failure, upgradeCommand: undefined })}\n`,
});
