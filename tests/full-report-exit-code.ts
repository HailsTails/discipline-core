import { checkCommandOutcome } from "../core/command-line/command-outcome.ts";
import type { LoadFailure } from "../core/command-line/load-failure.ts";
import type { ExitCode } from "../core/platform-ports/process-port.ts";
import type { Result } from "../core/values/result.ts";
import type { CheckReport } from "../core/verdict/check-report.ts";

const PROJECT_COMMAND = "node core/check/tool-command.ts project --repo .";

const PRUNE_COMMAND = "node core/check/tool-command.ts prune-debt --repo .";

export const fullReportExitCode = (request: { readonly checked: Result<CheckReport, LoadFailure> }): ExitCode =>
  checkCommandOutcome({
    result:
      request.checked.outcome === "failed"
        ? request.checked
        : { outcome: "ok", value: { report: request.checked.value, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND } },
  }).code;
