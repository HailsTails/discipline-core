import { z } from "zod";

export const forfeitureAssessmentSchema = z.enum(["this-run", "elsewhere"]);

export type ForfeitureAssessment = z.infer<typeof forfeitureAssessmentSchema>;

export const waivedClausesAssessmentSchema = z.enum(["run", "not-run"]);

export type WaivedClausesAssessment = z.infer<typeof waivedClausesAssessmentSchema>;

const ASSESSMENT_CONCERNS = {
  forfeiture: forfeitureAssessmentSchema.default("this-run"),
  waivedClauses: waivedClausesAssessmentSchema.default("run"),
};

const quotedKeys = (request: { readonly keys: readonly string[] }): string =>
  request.keys.map((key) => JSON.stringify(key)).join(", ");

export const assessmentSchema = z.strictObject(ASSESSMENT_CONCERNS, {
  error: (issue) =>
    issue.code === "unrecognized_keys"
      ? `not available in this version: ${quotedKeys({ keys: issue.keys })}; assessment takes ${quotedKeys({ keys: Object.keys(ASSESSMENT_CONCERNS) })} only`
      : undefined,
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
  waivedClauses: request.requested.waivedClauses ?? request.configured.waivedClauses,
});
