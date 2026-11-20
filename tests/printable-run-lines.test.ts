import { describe, expect, it } from "vitest";
import { RUN_PRINTABLE_LINES, RUN_SECTION_ROLES } from "./printable-run-lines.ts";

describe("RUN_PRINTABLE_LINES", () => {
  it.each([
    { label: "verdict", text: "verdict: pass", fills: {} },
    { label: "heading", text: "symptoms (3) guidance", fills: { section: "symptoms", count: "3" } },
    { label: "reference", text: "boundary-record runtime:clock", fills: { "outside party": "runtime:clock", module: "src/adapters/system-clock.ts" } },
  ])("includes the $label line $text with its sample values", (line) => {
    expect(RUN_PRINTABLE_LINES).toContainEqual(line);
  });

  it.each([
    {
      label: "findings",
      text: "date-used-directly#clock-sources walker src/orders/charge-order.ts:14:0 const chargedAt = clock.now(); may indicate: ports-declared-inside, written-out-answers, doer-or-orchestrator",
    },
    { label: "findings", text: "acme/AC-1#no-moment eslint src/orders/charge-order.ts:3:6 moment()" },
    { label: "refused", text: 'hone-records/debt/claimed-type.json records[1] unknown-symptom "claimed type"' },
    { label: "carried", text: "hone-records/authorised-locations/claimed-type.json records[6] unjudged lacks case, owes, whyChain" },
    { label: "notes", text: "conventions.generated is declared; no check reads it yet" },
  ])("includes the $label line $text", (line) => {
    expect(RUN_PRINTABLE_LINES).toContainEqual(expect.objectContaining(line));
  });
});

describe("RUN_SECTION_ROLES", () => {
  it("names each section once with its role, in the order the report prints them", () => {
    expect(RUN_SECTION_ROLES).toEqual([
      { section: "excluded", role: "informational" },
      { section: "notAdopted", role: "informational" },
      { section: "notRun", role: "informational" },
      { section: "editions", role: "informational" },
      { section: "findings", role: "failing" },
      { section: "answered", role: "informational" },
      { section: "uncovered", role: "failing" },
      { section: "stale", role: "failing" },
      { section: "forfeited", role: "failing" },
      { section: "unrecorded", role: "failing" },
      { section: "doublyHeld", role: "failing" },
      { section: "refused", role: "failing" },
      { section: "unmeasured", role: "failing" },
      { section: "projectionProblems", role: "failing" },
      { section: "assessment", role: "informational" },
      { section: "notes", role: "informational" },
      { section: "carried", role: "informational" },
      { section: "symptoms", role: "guidance" },
    ]);
  });
});
