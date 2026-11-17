import { describe, expect, it } from "vitest";
import { PRINTABLE_LINES, PRINTED_BLOCKS, PRINTED_SECTION_ROLES } from "./printable-lines.ts";

describe("PRINTABLE_LINES", () => {
  it.each([
    { label: "verdict", text: "verdict: pass", fills: {} },
    { label: "project", text: "disciplines.eslint.mjs written", fills: { path: "disciplines.eslint.mjs" } },
    { label: "version", text: "1.0.0", fills: { version: "1.0.0" } },
  ])("includes the $label line $text with its sample values", (line) => {
    expect(PRINTABLE_LINES).toContainEqual(line);
  });

  it.each([
    { label: "findings", text: "CD-15#loops eslint src/basket.ts:15:0 const total = 0;\\nreturn total;" },
    {
      label: "unmeasured",
      text: "import-unmeasured base-git-failed \"origin/main\": git could not read the exception records at that revision and said \"fatal: bad revision\"; Hone needs the exception records as they were at that revision",
    },
    { label: "runner-failed", text: "load failure: runner-failed eslint tool-failed eslint exited 2" },
    {
      label: "selection-absent",
      text: "load failure: selection-absent src holds no disciplines.json; give the folder that holds it, usually the repository root",
    },
    { label: "unexpected-error", text: "load failure: unexpected-error Cannot read properties of undefined" },
    { label: "flag-extra", text: "load failure: arguments-invalid hone --version takes nothing after it, not \"extra\"; run hone --help for usage" },
  ])("includes the $label line $text", (line) => {
    expect(PRINTABLE_LINES).toContainEqual(expect.objectContaining(line));
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

describe("PRINTED_BLOCKS", () => {
  it("fences the synopsis first, then the tool's help and each command's help", () => {
    expect(PRINTED_BLOCKS).toEqual([
      expect.stringMatching(/^```text\nhone check --repo <dir> [^\n]*\nhone project --repo <dir>\nhone --help\nhone --version\n```$/),
      expect.stringMatching(/^```text\nusage: hone <command> \[options\]\n[\s\S]*\n```$/),
      expect.stringMatching(/^```text\nusage: hone check [\s\S]*\n```$/),
      expect.stringMatching(/^```text\nusage: hone project [\s\S]*\n```$/),
    ]);
  });
});
