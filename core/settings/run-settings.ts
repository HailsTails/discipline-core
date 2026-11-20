import type { Assessment } from "../values/assessment.ts";
import type { ReportOutput } from "../values/report-output.ts";

export type RunSettings = {
  readonly reportOutput: ReportOutput;
  readonly assessment: Assessment;
};
