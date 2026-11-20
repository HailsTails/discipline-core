import { describe, expect, it } from "vitest";
import { boundaryReporting, boundaryWithLookupFlags, SILENT_BOUNDARY } from "./eslint-major-boundary-stub.ts";

const DESCRIPTOR = { loc: { line: 1, column: 0 }, messageId: "a" };

describe("the ESLint boundary stubs", () => {
  it("reports the data they are given", () => {
    expect(boundaryReporting({ data: { text: "x" } }).reportDataOf({ descriptor: DESCRIPTOR })).toEqual({ text: "x" });
  });

  it("names the lookup flags they are given", () => {
    expect(boundaryWithLookupFlags({ flags: ["a-flag"] }).nearestLookup).toEqual({ flags: ["a-flag"] });
  });

  it("reports no data and names no lookup flag when silent", () => {
    expect([SILENT_BOUNDARY.reportDataOf({ descriptor: DESCRIPTOR }), SILENT_BOUNDARY.nearestLookup]).toEqual([undefined, { flags: [] }]);
  });
});
