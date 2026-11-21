import { describe, expect, it } from "vitest";
import { ADOPTING_GUIDE_TEXT, documentedCheckRows, shippedCheckRows } from "./adopting-guide.ts";

describe("the table of checks in the adopting guide, read against the shipped symptom catalogue (CD-47: the shipped guide and catalogue are the assertion's subject; nothing is spawned or written)", () => {
  it("holds a row for every check the catalogue ships with its engines and clause address, and no row for a check it does not", () => {
    expect(documentedCheckRows({ text: ADOPTING_GUIDE_TEXT })).toEqual(shippedCheckRows());
  });

  it("reads the catalogue, so an empty table cannot match an unread one", () => {
    expect(shippedCheckRows()).not.toHaveLength(0);
  });
});
