import type { ProjectionWrite } from "../mechanism-port/runner-result-schema.ts";
import type { ExitCode } from "../platform-ports/process-port.ts";
import type { ReportOutput } from "../values/report-output.ts";
import type { Result } from "../values/result.ts";
import type { CheckReport } from "../verdict/check-report.ts";
import { renderGuidedReportText } from "../verdict/report-text.ts";
import { NO_SYMPTOM_GUIDE, type SymptomGuide } from "../verdict/symptom-notes.ts";
import { verdictOf } from "../verdict/verdict.ts";
import type { LoadFailure } from "./load-failure.ts";
import { loadFailureText } from "./load-failure-text.ts";

export type CommandOutcome = {
  readonly code: ExitCode;
  readonly text: string;
};

export type CheckRun = {
  readonly report: CheckReport;
  readonly output: ReportOutput;
  readonly projectCommand: string;
  readonly pruneCommand: string;
};

const LOAD_FAILURE_CODE = 2;

export const loadFailureOutcome =(request: { readonly failure: LoadFailure }): CommandOutcome => ({
  code: LOAD_FAILURE_CODE,
  text: loadFailureText(request),
});

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

export const projectCommandOutcome = (request: {
  readonly result: Result<readonly ProjectionWrite[], LoadFailure>;
}): CommandOutcome => {
  if (request.result.outcome === "failed") {
    return loadFailureOutcome({ failure: request.result.error });
  }
  return {
    code: 0,
    text: request.result.value.map((write) => `${write.path} ${write.effect}\n`).join(""),
  };
};

export const versionCommandOutcome = (request: { readonly result: Result<string, LoadFailure> }): CommandOutcome =>
  request.result.outcome === "failed"
    ? loadFailureOutcome({ failure: request.result.error })
    : { code: 0, text: `${request.result.value}\n` };

