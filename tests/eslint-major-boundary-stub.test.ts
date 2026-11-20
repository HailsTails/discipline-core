import { describe, expect, it } from "vitest";
import { boundaryNearestOnFlag, boundaryReporting, boundarySelectingLookup, boundaryWithLookupFlags, SILENT_BOUNDARY } from "./eslint-major-boundary-stub.ts";

const DESCRIPTOR = { loc: { line: 1, column: 0 }, messageId: "a" };

describe("the ESLint boundary stubs", () => {
  it("reports the data they are given", () => {
    expect(boundaryReporting({ data: { text: "x" } }).reportDataOf({ descriptor: DESCRIPTOR })).toEqual({ text: "x" });
  });

  it("select the lookup they are given", () => {
    expect(boundarySelectingLookup({ lookup: "repository-root" }).lookupSelectedBy({ flags: [] })).toBe("repository-root");
  });

  it("select the nearest lookup only when the flag they are given is named", () => {
    expect([
      boundaryNearestOnFlag({ flag: "a-flag" }).lookupSelectedBy({ flags: ["a-flag"] }),
      boundaryNearestOnFlag({ flag: "a-flag" }).lookupSelectedBy({ flags: [] }),
    ]).toEqual(["nearest-to-file", "repository-root"]);
  });

  it("names the lookup flags they are given", () => {
    expect(boundaryWithLookupFlags({ flags: ["a-flag"] }).nearestLookup).toEqual({ flags: ["a-flag"] });
  });

  it("reports no data and names no lookup flag when silent", () => {
    expect([SILENT_BOUNDARY.reportDataOf({ descriptor: DESCRIPTOR }), SILENT_BOUNDARY.nearestLookup]).toEqual([undefined, { flags: [] }]);
  });
});
