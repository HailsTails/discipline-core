import { describe, expect, it } from "vitest";
import {
  type Assessment,
  assessmentInEffect,
  assessmentSchema,
  DEFAULT_ASSESSMENT,
  type ForfeitureAssessment,
  forfeitureAssessmentSchema,
  type WaivedClausesAssessment,
  waivedClausesAssessmentSchema,
} from "./assessment.ts";

describe("forfeitureAssessmentSchema", () => {
  it.each(["this-run", "elsewhere"])("accepts %s", (forfeiture) => {
    expect(forfeitureAssessmentSchema.safeParse(forfeiture)).toEqual({ success: true, data: forfeiture });
  });

  it.each(["reported", "", "Elsewhere", "skip", true])("refuses %j", (forfeiture) => {
    expect(forfeitureAssessmentSchema.safeParse(forfeiture).success).toBe(false);
  });
});

describe("waivedClausesAssessmentSchema", () => {
  it.each(["run", "not-run"])("accepts %s", (waivedClauses) => {
    expect(waivedClausesAssessmentSchema.safeParse(waivedClauses)).toEqual({ success: true, data: waivedClauses });
  });

  it.each(["skip", "", "Not-Run", "not run", false])("refuses %j", (waivedClauses) => {
    expect(waivedClausesAssessmentSchema.safeParse(waivedClauses).success).toBe(false);
  });
});

describe("assessmentSchema", () => {
  it("is the default assessment for an empty object", () => {
    expect(assessmentSchema.parse({})).toEqual(DEFAULT_ASSESSMENT);
  });

  it("assesses forfeiture in this run and runs waived clauses by default", () => {
    expect(DEFAULT_ASSESSMENT).toEqual({ forfeiture: "this-run", waivedClauses: "run" });
  });

  it("reads forfeiture elsewhere", () => {
    expect(assessmentSchema.parse({ forfeiture: "elsewhere" })).toEqual({ forfeiture: "elsewhere", waivedClauses: "run" });
  });

  it("reads waived clauses not run", () => {
    expect(assessmentSchema.parse({ waivedClauses: "not-run" })).toEqual({ forfeiture: "this-run", waivedClauses: "not-run" });
  });

  it.each([
    ["eslint", { eslint: { evidence: "hone" } }],
    ["an unknown key", { lint: "skip" }],
  ])("refuses %s, which this release does not assess", (_key, assessment) => {
    expect(assessmentSchema.safeParse(assessment).success).toBe(false);
  });

  it.each([
    ["a forfeiture that is not one of the two", { forfeiture: "reported" }],
    ["a null forfeiture", { forfeiture: null }],
    ["a forfeiture list", { forfeiture: ["elsewhere"] }],
    ["a waived clauses value that is not one of the two", { waivedClauses: "skip" }],
    ["a boolean waived clauses value", { waivedClauses: false }],
  ])("refuses %s", (_shape, assessment) => {
    expect(assessmentSchema.safeParse(assessment).success).toBe(false);
  });
});

describe("assessmentInEffect", () => {
  it("is the configured assessment when no concern is requested for the run", () => {
    expect(
      assessmentInEffect({
        requested: { forfeiture: undefined, waivedClauses: undefined },
        configured: { forfeiture: "elsewhere", waivedClauses: "not-run" },
      }),
    ).toEqual({ forfeiture: "elsewhere", waivedClauses: "not-run" });
  });

  it.each<[ForfeitureAssessment, ForfeitureAssessment]>([
    ["this-run", "elsewhere"],
    ["elsewhere", "this-run"],
    ["elsewhere", "elsewhere"],
  ])("is the requested forfeiture %s over the configured %s, leaving waived clauses as configured", (requested, configured) => {
    const expected: Assessment = { forfeiture: requested, waivedClauses: "not-run" };

    expect(
      assessmentInEffect({
        requested: { forfeiture: requested, waivedClauses: undefined },
        configured: { forfeiture: configured, waivedClauses: "not-run" },
      }),
    ).toEqual(expected);
  });

  it.each<[WaivedClausesAssessment, WaivedClausesAssessment]>([
    ["run", "not-run"],
    ["not-run", "run"],
  ])("is the requested waived clauses %s over the configured %s, leaving forfeiture as configured", (requested, configured) => {
    const expected: Assessment = { forfeiture: "elsewhere", waivedClauses: requested };

    expect(
      assessmentInEffect({
        requested: { forfeiture: undefined, waivedClauses: requested },
        configured: { forfeiture: "elsewhere", waivedClauses: configured },
      }),
    ).toEqual(expected);
  });
});
