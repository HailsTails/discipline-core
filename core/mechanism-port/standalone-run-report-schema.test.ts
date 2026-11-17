import { describe, expect, it } from "vitest";
import { standaloneRunReportSchema } from "./standalone-run-report-schema.ts";

const CAST_EXPRESSIONS = { ruleSet: "hone", discipline: "CD-2", clause: "cast-expressions" };

const HIT_IN_A = {
  clause: CAST_EXPRESSIONS,
  file: "src/a.ts",
  anchor: { line: 3, column: 2 },
  snippet: "raw as User",
};

const EXPECTATION_IN_A = {
  kind: "inline-disable",
  clause: CAST_EXPRESSIONS,
  file: "src/a.ts",
  line: 5,
  text: "// @ts-expect-error legacy",
  reach: "one-clause",
};

describe("standaloneRunReportSchema", () => {
  it("accepts a report holding a hit and an inline disable", () => {
    const report = { hits: [HIT_IN_A], nativeExceptions: [EXPECTATION_IN_A] };
    expect(standaloneRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("accepts a report with no hits and no inline disables", () => {
    const report = { hits: [], nativeExceptions: [] };
    expect(standaloneRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("refuses a native exception of a kind a standalone runner cannot report, within that exception", () => {
    expect(
      standaloneRunReportSchema.safeParse({
        hits: [],
        nativeExceptions: [{ kind: "config-override", clause: CAST_EXPRESSIONS, file: "src/a.ts" }],
      }),
    ).toMatchObject({
      success: false,
      error: { issues: expect.arrayContaining([expect.objectContaining({ path: ["nativeExceptions", 0, "kind"] })]) },
    });
  });

  it("refuses a report with no native exceptions, at the nativeExceptions key", () => {
    expect(standaloneRunReportSchema.safeParse({ hits: [] })).toMatchObject({
      success: false,
      error: { issues: [{ path: ["nativeExceptions"] }] },
    });
  });

  it("refuses a bare list of hits, the shape a standalone run returned before it reported inline disables", () => {
    expect(standaloneRunReportSchema.safeParse([HIT_IN_A]).success).toBe(false);
  });
});
