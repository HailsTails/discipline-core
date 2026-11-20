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
    {
      label: "findings",
      text: "CD-17#clock-sources audit src/orders/charge-order.ts:14:0 const chargedAt = clock.now(); symptom: date-used-directly, may indicate: ports-declared-inside, written-out-answers, doer-or-orchestrator",
    },
    {
      label: "readFirst",
      text: "date-used-directly: Date used directly. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator. The breach usually sits in the unit that should be passed the time, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the clock adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#date-used-directly",
    },
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
      { section: "editions", role: "informational" },
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
      expect.stringMatching(/^```text\nhone check --repo <dir> [^\n]*\nhone project --repo <dir>\nhone record-debt --repo <dir> [^\n]*\nhone prune-debt --repo <dir> [^\n]*\nhone authorise --repo <dir> [^\n]*\nhone split-records --repo <dir>\nhone --help\nhone --version\n```$/),
      expect.stringMatching(/^```text\nusage: hone <command> \[options\]\n[\s\S]*\n```$/),
      expect.stringMatching(/^```text\nusage: hone check [\s\S]*\n```$/),
      expect.stringMatching(/^```text\nusage: hone project [\s\S]*\n```$/),
      expect.stringMatching(/^```text\nusage: hone record-debt [\s\S]*\n```$/),
      expect.stringMatching(/^```text\nusage: hone prune-debt [\s\S]*\n```$/),
      expect.stringMatching(/^```text\nusage: hone authorise [\s\S]*\n```$/),
      expect.stringMatching(/^```text\nusage: hone split-records [\s\S]*\n```$/),
    ]);
  });
});
