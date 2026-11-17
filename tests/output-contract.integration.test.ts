import { describe, expect, it } from "vitest";
import { contractGaps, contractTextAt, documentedLinesIn, documentedRolesIn } from "./output-contract.ts";
import { PRINTABLE_LINES, PRINTED_HELP_BLOCKS, PRINTED_SECTION_ROLES } from "./printable-lines.ts";

const CONTRACT_TEXT = contractTextAt({ path: `${import.meta.dirname}/../docs/output-contract.md` });

describe("docs/output-contract.md, read against every line the command can print (CD-47: the shipped contract page is the assertion's subject; nothing is spawned)", () => {
  it("documents every printed line, and every documented line is one the command prints", () => {
    expect(contractGaps({ documented: documentedLinesIn({ text: CONTRACT_TEXT }), printed: PRINTABLE_LINES })).toEqual({
      undocumented: [],
      unprinted: [],
    });
  });

  it("lists every report section in the order the report prints them, with its role", () => {
    expect(documentedRolesIn({ text: CONTRACT_TEXT })).toEqual(PRINTED_SECTION_ROLES);
  });

  it.each(PRINTED_HELP_BLOCKS)("shows each help exactly as printed: %s", (block) => {
    expect(CONTRACT_TEXT).toContain(block);
  });
});
