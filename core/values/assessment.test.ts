import { describe, expect, it } from "vitest";
import {
  type Assessment,
  assessmentInEffect,
  assessmentSchema,
  DEFAULT_ASSESSMENT,
  type ForfeitureAssessment,
  forfeitureAssessmentSchema,
} from "./assessment.ts";

describe("forfeitureAssessmentSchema", () => {
  it.each(["this-run", "elsewhere"])("accepts %s", (forfeiture) => {
    expect(forfeitureAssessmentSchema.safeParse(forfeiture)).toEqual({ success: true, data: forfeiture });
  });

  it.each(["reported", "", "Elsewhere", "skip", true])("refuses %j", (forfeiture) => {
    expect(forfeitureAssessmentSchema.safeParse(forfeiture).success).toBe(false);
  });
});

describe("assessmentSchema", () => {
  it("is the default assessment for an empty object", () => {
    expect(assessmentSchema.parse({})).toEqual(DEFAULT_ASSESSMENT);
  });

  it("assesses forfeiture in this run by default", () => {
    expect(DEFAULT_ASSESSMENT).toEqual({ forfeiture: "this-run" });
  });

  it("reads forfeiture elsewhere", () => {
    expect(assessmentSchema.parse({ forfeiture: "elsewhere" })).toEqual({ forfeiture: "elsewhere" });
  });

  it.each([
    ["eslint", { eslint: { evidence: "hone" } }],
    ["waivedClauses", { waivedClauses: "run" }],
    ["an unknown key", { lint: "skip" }],
  ])("refuses %s, which this release does not assess", (_key, assessment) => {
    expect(assessmentSchema.safeParse(assessment).success).toBe(false);
  });

  it.each([
    ["a value that is not one of the two", { forfeiture: "reported" }],
    ["null", { forfeiture: null }],
    ["a list", { forfeiture: ["elsewhere"] }],
  ])("refuses a forfeiture given as %s", (_shape, assessment) => {
    expect(assessmentSchema.safeParse(assessment).success).toBe(false);
  });
});

describe("assessmentInEffect", () => {
  it("is the configured assessment when no concern is requested for the run", () => {
    expect(
      assessmentInEffect({ requested: { forfeiture: undefined }, configured: { forfeiture: "elsewhere" } }),
    ).toEqual({ forfeiture: "elsewhere" });
  });

  it.each<[ForfeitureAssessment, ForfeitureAssessment]>([
    ["this-run", "elsewhere"],
    ["elsewhere", "this-run"],
    ["elsewhere", "elsewhere"],
  ])("is the requested forfeiture %s over the configured %s", (requested, configured) => {
    const expected: Assessment = { forfeiture: requested };

    expect(assessmentInEffect({ requested: { forfeiture: requested }, configured: { forfeiture: configured } })).toEqual(
      expected,
    );
  });
});
