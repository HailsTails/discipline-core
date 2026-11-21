import { describe, expect, it } from "vitest";
import { guideCheckTableOf, TABLE, TABLE_WITH_A_COMMA, WORKED_EXAMPLE, workedExampleOf } from "./adopting-guide.ts";

describe("guideCheckTableOf", () => {
  it("reads each row of the table with its engines and clause address", () => {
    expect(guideCheckTableOf({ text: TABLE }).rows).toEqual([
      { check: "loop-keyword#loop-statement", engines: ["walker"], clause: "CD-15#loops" },
      { check: "authored-class-or-this#class-keyword", engines: ["walker", "eslint"], clause: "CD-14#class-syntax" },
    ]);
  });

  it("reads only the table, leaving out a table that follows it", () => {
    expect(guideCheckTableOf({ text: TABLE })).toMatchObject({ unread: [] });
  });

  it("reports a row written in a form it does not know instead of dropping it", () => {
    expect(guideCheckTableOf({ text: TABLE_WITH_A_COMMA })).toMatchObject({
      rows: [{ check: "loop-keyword#loop-statement" }],
      unread: ["| `authored-class-or-this#class-keyword` | `walker`, `eslint` | `CD-14#class-syntax` |"],
    });
  });

  it("reads no rows from a document without the table", () => {
    expect(guideCheckTableOf({ text: "nothing here" })).toEqual({ rows: [], unread: [] });
  });
});

describe("workedExampleOf", () => {
  it("reads the four blocks of the worked example section in order, and none from other sections", () => {
    expect(workedExampleOf({ text: WORKED_EXAMPLE })).toEqual({
      blocks: 4,
      settings: { language: "json", body: "{ \"settings\": 1 }" },
      beforeReport: { language: "text", body: "before report" },
      records: { language: "json", body: "{ \"records\": 2 }" },
      afterReport: { language: "text", body: "after report" },
    });
  });

  it("counts the blocks it found, so a missing or extra block is seen", () => {
    expect(workedExampleOf({ text: "## Worked example\n\nno blocks\n" }).blocks).toBe(0);
  });
});
