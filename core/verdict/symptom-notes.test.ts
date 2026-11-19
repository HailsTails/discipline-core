import { describe, expect, it } from "vitest";
import type { Finding } from "../governance/governance.ts";
import type { Principle, Recipe, RecordKind, Rule, Symptom, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { NO_SYMPTOM_GUIDE, type SymptomGuide, symptomNoteLinesOf, symptomReadingIn } from "./symptom-notes.ts";

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const PORTS_DECLARED_INSIDE: Rule = {
  name: "ports-declared-inside",
  title: "Ports declared inside",
  principle: { name: "external-behaviour-sits-at-a-boundary", title: "External behaviour sits at a boundary" },
  standing: "accepted",
};

const WRITTEN_OUT_ANSWERS: Rule = { name: "written-out-answers", title: "Written-out answers", principle: TESTS_ARE_OURS, standing: "accepted" };

const DOER_OR_ORCHESTRATOR: Rule = {
  name: "doer-or-orchestrator",
  title: "Doer or orchestrator",
  principle: { name: "one-place-decides", title: "One place decides" },
  standing: "accepted",
};

const STRAIGHT_THROUGH_TESTS: Rule = { name: "straight-through-tests", title: "Straight-through tests", principle: TESTS_ARE_OURS, standing: "accepted" };

const HANDED_WHAT_IT_USES: Rule = { name: "handed-what-it-uses", title: "Handed what it uses", principle: TESTS_ARE_OURS, standing: "accepted" };

const WORLD_VALUES_THROUGH_A_PORT: Recipe = { name: "world-values-through-a-port", title: "World values through a port", standing: "accepted" };

const ASSERT_TO_NARROW: Recipe = { name: "assert-to-narrow", title: "Assert to narrow", standing: "accepted" };

const ITEACH_OVER_TYPED_ROWS: Recipe = { name: "iteach-over-typed-rows", title: "it.each over typed rows", standing: "accepted" };

const RESULT_UNION: Recipe = { name: "result-union", title: "Result union", standing: "accepted" };

const BOUNDARY_RECORD: RecordKind = { name: "boundary-record", title: "Boundary record", phrase: "a boundary record", todaysFormat: "authorised-location" };

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const DEVIATION: RecordKind = { name: "deviation", title: "Deviation", phrase: "a deviation", todaysFormat: "none-yet" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DATE_USED_DIRECTLY: Symptom = {
  name: "date-used-directly",
  title: "Date used directly",
  seen: "Any use of `Date` outside the places that handle dates.",
  mayIndicate: [
    {
      case: "Needs the current time",
      points: [
        { kind: "rule", rule: PORTS_DECLARED_INSIDE },
        { kind: "rule", rule: WRITTEN_OUT_ANSWERS },
      ],
    },
    { case: "Does one job", points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] },
  ],
  breachUsuallySits: "in the unit that should be passed the time, often a doer doing two jobs",
  recipes: [WORLD_VALUES_THROUGH_A_PORT],
  correctUses: [{ situation: "correct use", kind: BOUNDARY_RECORD, at: "on the clock adapter" }],
};

const BRANCH_IN_A_TEST: Symptom = {
  name: "branch-in-a-test",
  title: "Branch in a test",
  seen: "`if` in a test file.",
  mayIndicate: [
    {
      case: "Checks a value that may be one of several outcomes",
      points: [
        { kind: "rule", rule: STRAIGHT_THROUGH_TESTS },
        { kind: "principle", principle: NO_HIDDEN_EFFECTS },
      ],
    },
  ],
  breachUsuallySits: "in the unit's output type, where optional or loose shapes force the test to branch",
  recipes: [ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  correctUses: [],
};

const DOUBLE_WITH_A_BODY: Symptom = {
  name: "double-with-a-body",
  title: "Double with a body",
  seen: "A double that has a function body.",
  mayIndicate: [{ case: "Uses what a collaborator gives back", points: [{ kind: "rule", rule: HANDED_WHAT_IT_USES }] }],
  breachUsuallySits: "in a port too wide",
  recipes: [],
  correctUses: [
    { situation: "a fake, where a stub cannot do the test", kind: DEVIATION, at: "from Stub with vi.fn" },
    { situation: "a spy on a port the unit owns", kind: BOUNDARY_RECORD },
  ],
};

const CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS, TESTS_ARE_OURS],
  rules: [PORTS_DECLARED_INSIDE, WRITTEN_OUT_ANSWERS, DOER_OR_ORCHESTRATOR, STRAIGHT_THROUGH_TESTS, HANDED_WHAT_IT_USES],
  recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS, RESULT_UNION],
  recordKinds: [AUTHORISED_LOCATION, BOUNDARY_RECORD, DEBT, DEVIATION],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  symptoms: [DATE_USED_DIRECTLY, BRANCH_IN_A_TEST, DOUBLE_WITH_A_BODY],
  clauses: [
    { clause: clauseAddressSchema.parse("CD-17#clock-sources"), sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
    {
      clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
      sight: {
        kind: "symptom-by-form",
        forms: [
          { section: "branching-with-if", symptom: BRANCH_IN_A_TEST },
          { section: "logic-inside-a-function-the-test-passes-on", symptom: DOUBLE_WITH_A_BODY },
        ],
      },
    },
    { clause: clauseAddressSchema.parse("CD-9#result-failures"), sight: { kind: "method", recipe: RESULT_UNION, outcomeSeenBy: [DATE_USED_DIRECTLY] } },
  ],
};

const GUIDE: SymptomGuide = { guide: "catalogue", catalogue: CATALOGUE, page: "node_modules/@hailstails/hone/rules/typescript/symptoms.md" };

const CLOCK_FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-17#clock-sources"),
  mechanism: mechanismIdSchema.parse("audit"),
  file: repoPathSchema.parse("src/orders/charge-order.ts"),
  anchor: { line: 14, column: 0 },
  snippet: "const chargedAt = clock.now();",
};

const SECOND_CLOCK_FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-17#clock-sources"),
  mechanism: mechanismIdSchema.parse("audit"),
  file: repoPathSchema.parse("src/orders/refund-order.ts"),
  anchor: { line: 3, column: 0 },
  snippet: "const refundedAt = clock.now();",
};

const BRANCH_FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
  mechanism: mechanismIdSchema.parse("audit"),
  file: repoPathSchema.parse("src/orders/charge-order.test.ts"),
  anchor: { line: 22, column: 2 },
  snippet: "if (result.ok) {",
  remedy: { fix: "write one test per case", page: "node_modules/@hailstails/hone/rules/CD-27/CHECKS.md", section: "branching-with-if" },
};

const DOUBLE_FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
  mechanism: mechanismIdSchema.parse("audit"),
  file: repoPathSchema.parse("src/orders/charge-order.test.ts"),
  anchor: { line: 30, column: 4 },
  snippet: "kindOf: (path) => (installed.includes(path) ? \"file\" : \"missing\")",
  remedy: { fix: "make it a vi.fn spy", page: "node_modules/@hailstails/hone/rules/CD-27/CHECKS.md", section: "logic-inside-a-function-the-test-passes-on" },
};

const UNCATALOGUED_FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-15#loops"),
  mechanism: mechanismIdSchema.parse("audit"),
  file: repoPathSchema.parse("src/orders/totals.ts"),
  anchor: { line: 5, column: 2 },
  snippet: "const total = sumOf(lines);",
};

const METHOD_FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-9#result-failures"),
  mechanism: mechanismIdSchema.parse("audit"),
  file: repoPathSchema.parse("src/orders/totals.ts"),
  anchor: { line: 9, column: 2 },
  snippet: "throw new Error(\"no total\");",
};

const CLOCK_NOTE =
  "date-used-directly: Date used directly. May indicate: needs the current time → Ports declared inside, Written-out answers; does one job → Doer or orchestrator. The breach usually sits in the unit that should be passed the time, often a doer doing two jobs. Recipe: World values through a port. Correct use is answered by a boundary record on the clock adapter (today: authorised-location); known debt by debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#date-used-directly";

const BRANCH_NOTE =
  "branch-in-a-test: Branch in a test. May indicate: checks a value that may be one of several outcomes → Straight-through tests, No hidden effects. The breach usually sits in the unit's output type, where optional or loose shapes force the test to branch. Recipes: Assert to narrow; it.each over typed rows. Known debt is answered by debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#branch-in-a-test";

const DOUBLE_NOTE =
  "double-with-a-body: Double with a body. May indicate: uses what a collaborator gives back → Handed what it uses. The breach usually sits in a port too wide. A fake, where a stub cannot do the test is answered by a deviation from Stub with vi.fn (no record format yet); a spy on a port the unit owns by a boundary record (today: authorised-location); known debt by debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#double-with-a-body";

describe("symptomNoteLinesOf", () => {
  it("writes one note for a symptom, with its cases and rules, where its breach sits, its recipe, its correct use, and known debt", () => {
    expect(symptomNoteLinesOf({ guide: GUIDE, findings: [CLOCK_FINDING] })).toEqual([CLOCK_NOTE]);
  });

  it("writes each symptom's note once, however many findings show it, in the order the findings first show it", () => {
    expect(symptomNoteLinesOf({ guide: GUIDE, findings: [BRANCH_FINDING, CLOCK_FINDING, SECOND_CLOCK_FINDING, BRANCH_FINDING] })).toEqual([
      BRANCH_NOTE,
      CLOCK_NOTE,
    ]);
  });

  it("names no recipe when the symptom has none, lists each correct use in order, and says when a record kind has no format yet", () => {
    expect(symptomNoteLinesOf({ guide: GUIDE, findings: [DOUBLE_FINDING] })).toEqual([DOUBLE_NOTE]);
  });

  it("writes no note for a finding whose clause the catalogue does not hold, or whose clause sees no symptom", () => {
    expect(symptomNoteLinesOf({ guide: GUIDE, findings: [UNCATALOGUED_FINDING, METHOD_FINDING] })).toEqual([]);
  });

  it("writes no note when there is no catalogue", () => {
    expect(symptomNoteLinesOf({ guide: NO_SYMPTOM_GUIDE, findings: [CLOCK_FINDING] })).toEqual([]);
  });
});

describe("symptomReadingIn", () => {
  it("reads a finding's symptom from the guide's catalogue", () => {
    expect(symptomReadingIn({ guide: GUIDE, finding: CLOCK_FINDING })).toEqual({ reading: "named", symptom: DATE_USED_DIRECTLY });
  });

  it("finds no finding in the catalogue when there is no catalogue", () => {
    expect(symptomReadingIn({ guide: NO_SYMPTOM_GUIDE, finding: CLOCK_FINDING })).toEqual({ reading: "not-in-catalogue" });
  });
});
