import { describe, expect, it } from "vitest";
import { eslintBoundary } from "./eslint-10-boundary.ts";

describe("the ESLint 10 boundary", () => {
  it("asks for no lookup flag, since ESLint 10 looks up the nearest configuration by default", () => {
    expect(eslintBoundary.nearestLookup).toEqual({ flags: [] });
  });

  it("selects the nearest lookup whatever flags the lint scripts name", () => {
    expect([eslintBoundary.lookupSelectedBy({ flags: [] }), eslintBoundary.lookupSelectedBy({ flags: ["a_flag"] })]).toEqual([
      "nearest-to-file",
      "nearest-to-file",
    ]);
  });

  it("reads a report's data as ESLint 10 holds it", () => {
    expect(eslintBoundary.reportDataOf({ descriptor: { loc: { line: 1, column: 0 }, messageId: "a", data: { text: "x", count: 2 } } })).toEqual({
      text: "x",
      count: 2,
    });
  });

  it("reads a report without data as having none", () => {
    expect(eslintBoundary.reportDataOf({ descriptor: { loc: { line: 1, column: 0 }, messageId: "a" } })).toBeUndefined();
  });
});
