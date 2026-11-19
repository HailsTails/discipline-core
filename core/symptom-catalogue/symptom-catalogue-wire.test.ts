import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { principleNameSchema, recipeNameSchema, ruleNameSchema, symptomNameSchema } from "./symptom-catalogue.ts";
import { symptomCatalogueOf } from "./symptom-catalogue-wire.ts";

const DOCUMENT = {
  version: 1,
  principles: [{ name: "no-hidden-effects", title: "No hidden effects" }],
  rules: [{ name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: "no-hidden-effects", standing: "accepted" }],
  recipes: [{ name: "functional-iteration", title: "Functional iteration", standing: "accepted" }],
  recordKinds: [{ name: "debt", title: "Debt", todaysFormat: "file-carve-out" }],
  symptoms: [
    {
      name: "loop-keyword",
      title: "Loop keyword",
      seen: "`for` or `while`.",
      mayIndicate: [
        { case: "Makes a new value", points: [{ principle: "no-hidden-effects" }] },
        { case: "Coordinates other units", points: [{ rule: "doer-or-orchestrator" }] },
      ],
      breachUsuallySits: "The unit.",
      recipes: ["functional-iteration"],
      answeredBy: [{ kind: "debt", when: "a known breach not yet paid" }],
    },
  ],
  clauses: [
    { clause: "CD-15#loops", sight: { kind: "one-symptom", symptom: "loop-keyword" } },
    { clause: "CD-27#test-body-logic", sight: { kind: "symptom-by-form", forms: [{ section: "a-let", symptom: "loop-keyword" }] } },
    { clause: "CD-9#result-failures", sight: { kind: "method", recipe: "functional-iteration", outcomeSeenBy: ["loop-keyword"] } },
    { clause: "CD-32#pii-redaction", sight: { kind: "outside-the-cases" } },
  ],
};

describe("symptomCatalogueOf", () => {
  it("maps each point to a named rule or principle, and each clause to its address", () => {
    expect(symptomCatalogueOf({ document: DOCUMENT })).toEqual({
      outcome: "ok",
      value: {
        principles: [{ name: principleNameSchema.parse("no-hidden-effects"), title: "No hidden effects" }],
        rules: [
          {
            name: ruleNameSchema.parse("doer-or-orchestrator"),
            title: "Doer or orchestrator",
            principle: principleNameSchema.parse("no-hidden-effects"),
            standing: "accepted",
          },
        ],
        recipes: [{ name: recipeNameSchema.parse("functional-iteration"), title: "Functional iteration", standing: "accepted" }],
        recordKinds: [{ name: "debt", title: "Debt", todaysFormat: "file-carve-out" }],
        symptoms: [
          {
            name: symptomNameSchema.parse("loop-keyword"),
            title: "Loop keyword",
            seen: "`for` or `while`.",
            mayIndicate: [
              { case: "Makes a new value", points: [{ kind: "principle", name: principleNameSchema.parse("no-hidden-effects") }] },
              { case: "Coordinates other units", points: [{ kind: "rule", name: ruleNameSchema.parse("doer-or-orchestrator") }] },
            ],
            breachUsuallySits: "The unit.",
            recipes: [recipeNameSchema.parse("functional-iteration")],
            answeredBy: [{ kind: "debt", when: "a known breach not yet paid" }],
          },
        ],
        clauses: [
          { clause: clauseAddressSchema.parse("CD-15#loops"), sight: { kind: "one-symptom", symptom: symptomNameSchema.parse("loop-keyword") } },
          {
            clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
            sight: { kind: "symptom-by-form", forms: [{ section: "a-let", symptom: symptomNameSchema.parse("loop-keyword") }] },
          },
          {
            clause: clauseAddressSchema.parse("CD-9#result-failures"),
            sight: { kind: "method", recipe: recipeNameSchema.parse("functional-iteration"), outcomeSeenBy: [symptomNameSchema.parse("loop-keyword")] },
          },
          { clause: clauseAddressSchema.parse("CD-32#pii-redaction"), sight: { kind: "outside-the-cases" } },
        ],
      },
    });
  });

  it("maps an empty catalogue to an empty catalogue", () => {
    expect(
      symptomCatalogueOf({ document: { version: 1, principles: [], rules: [], recipes: [], recordKinds: [], symptoms: [], clauses: [] } }),
    ).toEqual({ outcome: "ok", value: { principles: [], rules: [], recipes: [], recordKinds: [], symptoms: [], clauses: [] } });
  });

  type RefusalRow = { readonly name: string; readonly document: unknown; readonly refusal: string };

  it.each<RefusalRow>([
    {
      name: "a name that is not lower-case and hyphenated",
      document: { version: 1, principles: [{ name: "No hidden effects", title: "No hidden effects" }], rules: [], recipes: [], recordKinds: [], symptoms: [], clauses: [] },
      refusal: "is not a lower-case hyphenated name",
    },
    {
      name: "a principle listed twice",
      document: {
        version: 1,
        principles: [
          { name: "no-hidden-effects", title: "No hidden effects" },
          { name: "no-hidden-effects", title: "No hidden effects" },
        ],
        rules: [],
        recipes: [],
        recordKinds: [],
        symptoms: [],
        clauses: [],
      },
      refusal: "principles holds no-hidden-effects more than once",
    },
    {
      name: "a clause listed twice",
      document: {
        version: 1,
        principles: [],
        rules: [],
        recipes: [],
        recordKinds: [],
        symptoms: [],
        clauses: [
          { clause: "CD-32#pii-redaction", sight: { kind: "outside-the-cases" } },
          { clause: "hone/CD-32#pii-redaction", sight: { kind: "outside-the-cases" } },
        ],
      },
      refusal: "clauses holds CD-32#pii-redaction more than once",
    },
    {
      name: "a form section listed twice for one clause",
      document: {
        version: 1,
        principles: [],
        rules: [],
        recipes: [],
        recordKinds: [{ name: "debt", title: "Debt", todaysFormat: "file-carve-out" }],
        symptoms: [
          {
            name: "rebinding",
            title: "Rebinding",
            seen: "A `let` assigned again.",
            mayIndicate: [{ case: "Makes a new value", points: [{ principle: "no-hidden-effects" }] }],
            breachUsuallySits: "The unit.",
            recipes: [],
            answeredBy: [{ kind: "debt", when: "a known breach not yet paid" }],
          },
        ],
        clauses: [
          {
            clause: "CD-27#test-body-logic",
            sight: {
              kind: "symptom-by-form",
              forms: [
                { section: "a-let", symptom: "rebinding" },
                { section: "a-let", symptom: "rebinding" },
              ],
            },
          },
        ],
      },
      refusal: "the forms of CD-27#test-body-logic holds a-let more than once",
    },
    {
      name: "a rule under a principle the catalogue does not hold",
      document: {
        version: 1,
        principles: [],
        rules: [{ name: "guard-first", title: "Guard first", principle: "one-place-decides", standing: "accepted" }],
        recipes: [],
        recordKinds: [],
        symptoms: [],
        clauses: [],
      },
      refusal: "rules names one-place-decides, which the catalogue does not hold",
    },
    {
      name: "a symptom pointing at a rule the catalogue does not hold",
      document: {
        version: 1,
        principles: [],
        rules: [],
        recipes: [],
        recordKinds: [{ name: "debt", title: "Debt", todaysFormat: "file-carve-out" }],
        symptoms: [
          {
            name: "work-inside-a-condition",
            title: "Work inside a condition",
            seen: "An `if` inside another `if`.",
            mayIndicate: [{ case: "Checks conditions", points: [{ rule: "guard-first" }] }],
            breachUsuallySits: "The unit's questions.",
            recipes: [],
            answeredBy: [{ kind: "debt", when: "a known breach not yet paid" }],
          },
        ],
        clauses: [],
      },
      refusal: "symptoms names guard-first, which the catalogue does not hold",
    },
    {
      name: "a symptom with a recipe the catalogue does not hold",
      document: {
        version: 1,
        principles: [],
        rules: [],
        recipes: [],
        recordKinds: [{ name: "debt", title: "Debt", todaysFormat: "file-carve-out" }],
        symptoms: [
          {
            name: "work-inside-a-condition",
            title: "Work inside a condition",
            seen: "An `if` inside another `if`.",
            mayIndicate: [{ case: "Checks conditions", points: [{ principle: "one-place-decides" }] }],
            breachUsuallySits: "The unit's questions.",
            recipes: ["guard-clauses"],
            answeredBy: [{ kind: "debt", when: "a known breach not yet paid" }],
          },
        ],
        clauses: [],
      },
      refusal: "symptoms names guard-clauses, which the catalogue does not hold",
    },
    {
      name: "a symptom answered by a record kind the catalogue does not hold",
      document: {
        version: 1,
        principles: [{ name: "one-place-decides", title: "One place decides" }],
        rules: [],
        recipes: [],
        recordKinds: [],
        symptoms: [
          {
            name: "work-inside-a-condition",
            title: "Work inside a condition",
            seen: "An `if` inside another `if`.",
            mayIndicate: [{ case: "Checks conditions", points: [{ principle: "one-place-decides" }] }],
            breachUsuallySits: "The unit's questions.",
            recipes: [],
            answeredBy: [{ kind: "debt", when: "a known breach not yet paid" }],
          },
        ],
        clauses: [],
      },
      refusal: "symptoms names debt, which the catalogue does not hold",
    },
    {
      name: "a clause seeing a symptom the catalogue does not hold",
      document: {
        version: 1,
        principles: [],
        rules: [],
        recipes: [],
        recordKinds: [],
        symptoms: [],
        clauses: [{ clause: "CD-15#loops", sight: { kind: "one-symptom", symptom: "loop-keyword" } }],
      },
      refusal: "clauses names loop-keyword, which the catalogue does not hold",
    },
    {
      name: "a clause demanding a method whose outcome no symptom sees",
      document: {
        version: 1,
        principles: [],
        rules: [],
        recipes: [],
        recordKinds: [],
        symptoms: [],
        clauses: [{ clause: "CD-9#result-failures", sight: { kind: "method", recipe: "result-union", outcomeSeenBy: [] } }],
      },
      refusal: "outcomeSeenBy",
    },
    {
      name: "a field the catalogue does not define",
      document: { version: 1, principles: [], rules: [], recipes: [], recordKinds: [], symptoms: [], clauses: [], numbers: [] },
      refusal: "numbers",
    },
    {
      name: "a version other than 1",
      document: { version: 2, principles: [], rules: [], recipes: [], recordKinds: [], symptoms: [], clauses: [] },
      refusal: "version",
    },
  ])("refuses $name", ({ document, refusal }) => {
    expect(symptomCatalogueOf({ document })).toEqual({ outcome: "failed", error: expect.stringContaining(refusal) });
  });

  it("refuses a clause demanding a recipe the catalogue does not hold, naming only that recipe", () => {
    expect(
      symptomCatalogueOf({
        document: {
          version: 1,
          principles: [{ name: "one-place-decides", title: "One place decides" }],
          rules: [],
          recipes: [],
          recordKinds: [{ name: "debt", title: "Debt", todaysFormat: "file-carve-out" }],
          symptoms: [
            {
              name: "work-inside-a-condition",
              title: "Work inside a condition",
              seen: "An `if` inside another `if`.",
              mayIndicate: [{ case: "Checks conditions", points: [{ principle: "one-place-decides" }] }],
              breachUsuallySits: "The unit's questions.",
              recipes: [],
              answeredBy: [{ kind: "debt", when: "a known breach not yet paid" }],
            },
          ],
          clauses: [{ clause: "CD-9#result-failures", sight: { kind: "method", recipe: "result-union", outcomeSeenBy: ["work-inside-a-condition"] } }],
        },
      }),
    ).toEqual({ outcome: "failed", error: "✖ clauses names result-union, which the catalogue does not hold" });
  });
});
