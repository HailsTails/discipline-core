import type { Assessment } from "../values/assessment.ts";

export type RunSettings<Output extends string> = {
  readonly reportOutput: Output;
  readonly assessment: Assessment;
};
