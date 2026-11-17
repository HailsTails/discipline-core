import { describe, expect, it } from "vitest";
import { contractGaps, contractTextAt, documentedLinesIn, documentedRolesIn } from "./output-contract.ts";
import { PRINTABLE_LINES, PRINTED_BLOCKS, PRINTED_SECTION_ROLES } from "./printable-lines.ts";

const CONTRACT_TEXT = contractTextAt({ path: `${import.meta.dirname}/../docs/output-contract.md` });

const README_TEXT = contractTextAt({ path: `${import.meta.dirname}/../README.md` });

describe("docs/output-contract.md, read against every line the command can print (CD-47: the shipped contract page is the assertion's subject; nothing is spawned)", () => {
  it("documents every printed line as its template filled with that line's own sample values, and every documented line is one the command prints", () => {
    expect(contractGaps({ documented: documentedLinesIn({ text: CONTRACT_TEXT }), printed: PRINTABLE_LINES })).toEqual({
      undocumented: [],
      unprinted: [],
    });
  });

  it("lists every report section in the order the report prints them, with its role", () => {
    expect(documentedRolesIn({ text: CONTRACT_TEXT })).toEqual(PRINTED_SECTION_ROLES);
  });

  it.each(PRINTED_BLOCKS)("shows the synopsis and each help exactly as printed: %s", (block) => {
    expect(CONTRACT_TEXT).toContain(block);
  });

  it("shows the README the same synopsis the command prints", () => {
    expect(README_TEXT).toContain(PRINTED_BLOCKS[0]);
  });
});
