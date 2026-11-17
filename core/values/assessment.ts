import { z } from "zod";

export const forfeitureAssessmentSchema = z.enum(["this-run", "elsewhere"]);

export type ForfeitureAssessment = z.infer<typeof forfeitureAssessmentSchema>;

export const assessmentSchema = z.strictObject({
  forfeiture: forfeitureAssessmentSchema.default("this-run"),
});

export type Assessment = z.infer<typeof assessmentSchema>;

export type AssessmentRequest = {
  readonly [Concern in keyof Assessment]: Assessment[Concern] | undefined;
};

export const DEFAULT_ASSESSMENT: Assessment = assessmentSchema.parse({});

export const assessmentInEffect = (request: {
  readonly requested: AssessmentRequest;
  readonly configured: Assessment;
}): Assessment => ({
  forfeiture: request.requested.forfeiture ?? request.configured.forfeiture,
});
