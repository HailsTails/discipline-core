import { describe, expect, it } from "vitest";
import type { Finding } from "../governance/governance.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import {
  EMPTY_SYMPTOM_CATALOGUE,
  principleNameSchema,
  recipeNameSchema,
  ruleNameSchema,
  type Symptom,
  type SymptomCatalogue,
  type SymptomReading,
  symptomNameSchema,
  symptomReadingOf,
} from "./symptom-catalogue.ts";

const BRANCH_IN_A_TEST: Symptom = {
  name: symptomNameSchema.parse("branch-in-a-test"),
  title: "Branch in a test",
  seen: "`if` in a test file.",
  mayIndicate: [{ case: "Checks a value that may be one of several outcomes", points: [{ kind: "rule", name: ruleNameSchema.parse("straight-through-tests") }] }],
  breachUsuallySits: "Often the unit's output type.",
  recipes: [recipeNameSchema.parse("assert-to-narrow")],
  answeredBy: [{ kind: "debt", when: "a known breach not yet paid" }],
};

const REBINDING: Symptom = {
  name: symptomNameSchema.parse("rebinding"),
  title: "Rebinding",
  seen: "A `let` assigned again.",
  mayIndicate: [{ case: "Makes a new value", points: [{ kind: "principle", name: principleNameSchema.parse("no-hidden-effects") }] }],
  breachUsuallySits: "The unit.",
  recipes: [],
  answeredBy: [{ kind: "debt", when: "a known breach not yet paid" }],
};

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  recipes: [],
  recordKinds: [],
  symptoms: [BRANCH_IN_A_TEST, REBINDING],
  clauses: [
    { clause: clauseAddressSchema.parse("CD-44#parameter-reassignment"), sight: { kind: "one-symptom", symptom: symptomNameSchema.parse("rebinding") } },
    {
      clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
      sight: {
        kind: "symptom-by-form",
        forms: [
          { section: "branching-with-if", symptom: symptomNameSchema.parse("branch-in-a-test") },
          { section: "a-let", symptom: symptomNameSchema.parse("rebinding") },
        ],
      },
    },
    {
      clause: clauseAddressSchema.parse("CD-9#result-failures"),
      sight: { kind: "method", recipe: recipeNameSchema.parse("result-union"), outcomeSeenBy: [symptomNameSchema.parse("rebinding")] },
    },
    { clause: clauseAddressSchema.parse("CD-32#pii-redaction"), sight: { kind: "outside-the-cases" } },
    { clause: clauseAddressSchema.parse("CD-15#loops"), sight: { kind: "one-symptom", symptom: symptomNameSchema.parse("loop-keyword") } },
  ],
};

type ReadingRow = {
  readonly name: string;
  readonly finding: Pick<Finding, "clause" | "remedy">;
  readonly reading: SymptomReading;
};

describe("symptomReadingOf", () => {
  it.each<ReadingRow>([
    {
      name: "names the one symptom a clause sees",
      finding: { clause: clauseAddressSchema.parse("CD-44#parameter-reassignment") },
      reading: { reading: "named", symptom: REBINDING },
    },
    {
      name: "names the symptom of the form a by-form clause's finding gives as its section",
      finding: {
        clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
        remedy: { fix: "write one test per case", page: "CHECKS.md", section: "branching-with-if" },
      },
      reading: { reading: "named", symptom: BRANCH_IN_A_TEST },
    },
    {
      name: "names another form's symptom for another section of the same clause",
      finding: { clause: clauseAddressSchema.parse("CD-27#test-body-logic"), remedy: { fix: "write the values out", page: "CHECKS.md", section: "a-let" } },
      reading: { reading: "named", symptom: REBINDING },
    },
    {
      name: "is not in the catalogue for a by-form clause's section the catalogue does not list",
      finding: { clause: clauseAddressSchema.parse("CD-27#test-body-logic"), remedy: { fix: "write it out", page: "CHECKS.md", section: "a-new-form" } },
      reading: { reading: "not-in-catalogue" },
    },
    {
      name: "is not in the catalogue for a by-form clause's finding with no section",
      finding: { clause: clauseAddressSchema.parse("CD-27#test-body-logic") },
      reading: { reading: "not-in-catalogue" },
    },
    {
      name: "sees no symptom for a clause that demands a method",
      finding: { clause: clauseAddressSchema.parse("CD-9#result-failures") },
      reading: { reading: "sees-no-symptom" },
    },
    {
      name: "sees no symptom for a clause outside the cases",
      finding: { clause: clauseAddressSchema.parse("CD-32#pii-redaction") },
      reading: { reading: "sees-no-symptom" },
    },
    {
      name: "is not in the catalogue for a clause the catalogue does not list",
      finding: { clause: clauseAddressSchema.parse("CD-17#clock-sources") },
      reading: { reading: "not-in-catalogue" },
    },
    {
      name: "is not in the catalogue for the same clause in a team's rule set",
      finding: { clause: clauseAddressSchema.parse("team/CD-44#parameter-reassignment") },
      reading: { reading: "not-in-catalogue" },
    },
    {
      name: "is not in the catalogue for a clause whose symptom the catalogue does not hold",
      finding: { clause: clauseAddressSchema.parse("CD-15#loops") },
      reading: { reading: "not-in-catalogue" },
    },
  ])("$name", ({ finding, reading }) => {
    expect(symptomReadingOf({ catalogue: CATALOGUE, finding })).toEqual(reading);
  });

  it("is not in the catalogue for any clause when the catalogue is empty", () => {
    expect(
      symptomReadingOf({ catalogue: EMPTY_SYMPTOM_CATALOGUE, finding: { clause: clauseAddressSchema.parse("CD-44#parameter-reassignment") } }),
    ).toEqual({ reading: "not-in-catalogue" });
  });
});

describe("EMPTY_SYMPTOM_CATALOGUE", () => {
  it("holds nothing", () => {
    expect(EMPTY_SYMPTOM_CATALOGUE).toEqual({ principles: [], rules: [], recipes: [], recordKinds: [], symptoms: [], clauses: [] });
  });
});
