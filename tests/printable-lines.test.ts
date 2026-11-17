import { describe, expect, it } from "vitest";
import { PRINTABLE_LINES, PRINTED_HELP_BLOCKS, PRINTED_SECTION_ROLES } from "./printable-lines.ts";

describe("PRINTABLE_LINES", () => {
  it.each([
    { label: "verdict", text: "verdict: pass" },
    { label: "findings", text: "CD-15#loops audit src/basket.ts:15:0 const total = 0;\\nreturn total;" },
    { label: "unmeasured", text: "mechanism-not-run eslint not-included" },
    { label: "runner-failed", text: "load failure: runner-failed eslint tool-failed eslint exited 2" },
    { label: "selection-absent", text: "load failure: arguments-invalid --repo src holds no disciplines.json; give the folder that holds it, usually the repository root" },
    { label: "project", text: "disciplines.eslint.mjs written" },
    { label: "version", text: "1.0.0" },
  ])("includes the $label line $text", (line) => {
    expect(PRINTABLE_LINES).toContainEqual(line);
  });
});

describe("PRINTED_SECTION_ROLES", () => {
  it("names each section once with its role, in the order the report prints them", () => {
    expect(PRINTED_SECTION_ROLES).toEqual([
      { section: "excluded", role: "informational" },
      { section: "notAdopted", role: "informational" },
      { section: "notRun", role: "informational" },
      { section: "findings", role: "failing" },
      { section: "exempted", role: "informational" },
      { section: "uncovered", role: "failing" },
      { section: "stale", role: "failing" },
      { section: "forfeited", role: "failing" },
      { section: "unrecorded", role: "failing" },
      { section: "doublyHeld", role: "failing" },
      { section: "invalidRecords", role: "failing" },
      { section: "unmeasured", role: "failing" },
      { section: "projectionProblems", role: "failing" },
      { section: "assessment", role: "informational" },
      { section: "readFirst", role: "guidance" },
    ]);
  });
});

describe("PRINTED_HELP_BLOCKS", () => {
  it("fences each help text as a text block", () => {
    expect(PRINTED_HELP_BLOCKS[0]).toMatch(/^```text\nusage: hone <command> \[options\]\n[\s\S]*\n```$/);
  });
});
