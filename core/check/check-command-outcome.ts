import { type CommandOutcome, loadFailureOutcome } from "../command-line/command-outcome.ts";
import type { LoadFailure } from "../command-line/load-failure.ts";
import type { ReportOutput } from "../values/report-output.ts";
import type { Result } from "../values/result.ts";
import type { CheckReport } from "../verdict/check-report.ts";
import { renderGuidedReportText } from "../verdict/report-text.ts";
import { NO_SYMPTOM_GUIDE, type SymptomGuide } from "../verdict/symptom-notes.ts";
import { verdictOf } from "../verdict/verdict.ts";

export type CheckRun = {
  readonly report: CheckReport;
  readonly output: ReportOutput;
  readonly projectCommand: string;
  readonly pruneCommand: string;
};

export type GuidedCheckRun = CheckRun & { readonly guide: SymptomGuide };

const guidedCheckRunOutcome = (request: { readonly run: GuidedCheckRun }): CommandOutcome => ({
  code: verdictOf({ report: request.run.report }) === "pass" ? 0 : 1,
  text: renderGuidedReportText(request.run),
});

export const guidedCheckCommandOutcome = (request: {
  readonly result: Result<GuidedCheckRun, LoadFailure>;
}): CommandOutcome =>
  request.result.outcome === "failed"
    ? loadFailureOutcome({ failure: request.result.error })
    : guidedCheckRunOutcome({ run: request.result.value });

export const checkCommandOutcome = (request: {
  readonly result: Result<CheckRun, LoadFailure>;
}): CommandOutcome =>
  guidedCheckCommandOutcome({
    result: request.result.outcome === "failed" ? request.result : { outcome: "ok", value: { ...request.result.value, guide: NO_SYMPTOM_GUIDE } },
  });
