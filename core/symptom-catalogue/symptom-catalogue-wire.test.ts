import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../values/clause-address.ts";
import type { Principle, Recipe, RecordKind, Rule, Symptom } from "./symptom-catalogue.ts";
import { symptomCatalogueOf } from "./symptom-catalogue-wire.ts";

const RECORD_KINDS_DOCUMENT = [
  { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" },
  { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" },
];

const DOCUMENT = {
  version: 1,
  principles: [{ name: "no-hidden-effects", title: "No hidden effects" }],
  rules: [{ name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: "no-hidden-effects", standing: "accepted" }],
  recipes: [{ name: "functional-iteration", title: "Functional iteration", standing: "accepted" }],
  recordKinds: RECORD_KINDS_DOCUMENT,
  symptoms: [
    {
      name: "loop-keyword",
      title: "Loop keyword",
      seen: "`for` or `while`.",
      mayIndicate: [
        { case: "Makes a new value", points: [{ principle: "no-hidden-effects" }] },
        { case: "Coordinates other units", points: [{ rule: "doer-or-orchestrator" }] },
      ],
      breachUsuallySits: "in the unit",
      recipes: ["functional-iteration"],
      correctUses: [
        { situation: "draining a stream", kind: "authorised-location", at: "in its source's adapter" },
        { situation: "a known stream", kind: "debt" },
      ],
    },
  ],
  clauses: [
    { clause: "CD-15#loops", sight: { kind: "one-symptom", symptom: "loop-keyword" } },
    { clause: "CD-27#test-body-logic", sight: { kind: "symptom-by-form", forms: [{ section: "a-let", symptom: "loop-keyword" }] } },
    { clause: "CD-9#result-failures", sight: { kind: "method", recipe: "functional-iteration", outcomeSeenBy: ["loop-keyword"] } },
    { clause: "CD-32#pii-redaction", sight: { kind: "outside-the-cases" } },
  ],
};

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DOER_OR_ORCHESTRATOR: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: NO_HIDDEN_EFFECTS, standing: "accepted" };

const FUNCTIONAL_ITERATION: Recipe = { name: "functional-iteration", title: "Functional iteration", standing: "accepted" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const LOOP_KEYWORD: Symptom = {
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [
    { case: "Makes a new value", points: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }] },
    { case: "Coordinates other units", points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] },
  ],
  breachUsuallySits: "in the unit",
  recipes: [FUNCTIONAL_ITERATION],
  correctUses: [
    { situation: "draining a stream", kind: AUTHORISED_LOCATION, at: "in its source's adapter" },
    { situation: "a known stream", kind: DEBT },
  ],
};

const EMPTY_DOCUMENT = { version: 1, principles: [], rules: [], recipes: [], recordKinds: RECORD_KINDS_DOCUMENT, symptoms: [], clauses: [] };

const SYMPTOM_DOCUMENT = {
  name: "work-inside-a-condition",
  title: "Work inside a condition",
  seen: "An `if` inside another `if`.",
  mayIndicate: [{ case: "Checks conditions", points: [{ principle: "one-place-decides" }] }],
  breachUsuallySits: "in the unit's questions",
  recipes: [],
  correctUses: [],
};

const ONE_PLACE_DECIDES_DOCUMENT = [{ name: "one-place-decides", title: "One place decides" }];

describe("symptomCatalogueOf", () => {
  it("resolves every name a document gives to the entry it names, field by field", () => {
    expect(symptomCatalogueOf({ document: DOCUMENT })).toEqual({
      outcome: "ok",
      value: {
        principles: [NO_HIDDEN_EFFECTS],
        rules: [DOER_OR_ORCHESTRATOR],
        recipes: [FUNCTIONAL_ITERATION],
        recordKinds: [AUTHORISED_LOCATION, DEBT],
        alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
        symptoms: [LOOP_KEYWORD],
        clauses: [
          { clause: clauseAddressSchema.parse("CD-15#loops"), sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
          { clause: clauseAddressSchema.parse("CD-27#test-body-logic"), sight: { kind: "symptom-by-form", forms: [{ section: "a-let", symptom: LOOP_KEYWORD }] } },
          { clause: clauseAddressSchema.parse("CD-9#result-failures"), sight: { kind: "method", recipe: FUNCTIONAL_ITERATION, outcomeSeenBy: [LOOP_KEYWORD] } },
          { clause: clauseAddressSchema.parse("CD-32#pii-redaction"), sight: { kind: "outside-the-cases" } },
        ],
      },
    });
  });

  it("reads a catalogue that holds only the record kinds every symptom takes", () => {
    expect(symptomCatalogueOf({ document: EMPTY_DOCUMENT })).toEqual({
      outcome: "ok",
      value: {
        principles: [],
        rules: [],
        recipes: [],
        recordKinds: [AUTHORISED_LOCATION, DEBT],
        alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
        symptoms: [],
        clauses: [],
      },
    });
  });

  type RefusalRow = { readonly name: string; readonly document: unknown; readonly refusal: string };

  it.each<RefusalRow>([
    {
      name: "a name that is not lower-case and hyphenated",
      document: { ...EMPTY_DOCUMENT, principles: [{ name: "No hidden effects", title: "No hidden effects" }] },
      refusal: "✖ is not a lower-case hyphenated name\n  → at principles[0].name",
    },
    {
      name: "a principle listed twice",
      document: {
        ...EMPTY_DOCUMENT,
        principles: [
          { name: "no-hidden-effects", title: "No hidden effects" },
          { name: "no-hidden-effects", title: "No hidden effects" },
        ],
      },
      refusal: "✖ principles holds no-hidden-effects more than once",
    },
    {
      name: "a clause listed twice",
      document: {
        ...EMPTY_DOCUMENT,
        clauses: [
          { clause: "CD-32#pii-redaction", sight: { kind: "outside-the-cases" } },
          { clause: "hone/CD-32#pii-redaction", sight: { kind: "outside-the-cases" } },
        ],
      },
      refusal: "✖ clauses holds CD-32#pii-redaction more than once",
    },
    {
      name: "a form section listed twice for one clause",
      document: {
        ...EMPTY_DOCUMENT,
        principles: ONE_PLACE_DECIDES_DOCUMENT,
        symptoms: [SYMPTOM_DOCUMENT],
        clauses: [
          {
            clause: "CD-27#test-body-logic",
            sight: {
              kind: "symptom-by-form",
              forms: [
                { section: "a-let", symptom: "work-inside-a-condition" },
                { section: "a-let", symptom: "work-inside-a-condition" },
              ],
            },
          },
        ],
      },
      refusal: "✖ the forms of CD-27#test-body-logic holds a-let more than once",
    },
    {
      name: "a rule under a principle the catalogue does not hold",
      document: { ...EMPTY_DOCUMENT, rules: [{ name: "guard-first", title: "Guard first", principle: "one-place-decides", standing: "accepted" }] },
      refusal: "✖ rules names one-place-decides, which the catalogue does not hold",
    },
    {
      name: "a symptom pointing at a rule the catalogue does not hold",
      document: {
        ...EMPTY_DOCUMENT,
        symptoms: [{ ...SYMPTOM_DOCUMENT, mayIndicate: [{ case: "Checks conditions", points: [{ rule: "guard-first" }] }] }],
      },
      refusal: "✖ symptoms names guard-first, which the catalogue does not hold",
    },
    {
      name: "a symptom pointing at a principle the catalogue does not hold",
      document: { ...EMPTY_DOCUMENT, symptoms: [SYMPTOM_DOCUMENT] },
      refusal: "✖ symptoms names one-place-decides, which the catalogue does not hold",
    },
    {
      name: "a symptom with a recipe the catalogue does not hold",
      document: { ...EMPTY_DOCUMENT, principles: ONE_PLACE_DECIDES_DOCUMENT, symptoms: [{ ...SYMPTOM_DOCUMENT, recipes: ["guard-clauses"] }] },
      refusal: "✖ symptoms names guard-clauses, which the catalogue does not hold",
    },
    {
      name: "a correct use by a record kind the catalogue does not hold",
      document: {
        ...EMPTY_DOCUMENT,
        principles: ONE_PLACE_DECIDES_DOCUMENT,
        symptoms: [{ ...SYMPTOM_DOCUMENT, correctUses: [{ situation: "correct use", kind: "boundary-record", at: "on the clock adapter" }] }],
      },
      refusal: "✖ symptoms names boundary-record, which the catalogue does not hold",
    },
    {
      name: "a catalogue without debt, which every symptom takes",
      document: { ...EMPTY_DOCUMENT, recordKinds: [{ name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" }] },
      refusal: "✖ recordKinds holds no debt, which every symptom takes",
    },
    {
      name: "a catalogue without an authorised location, which every symptom takes",
      document: { ...EMPTY_DOCUMENT, recordKinds: [{ name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" }] },
      refusal: "✖ recordKinds holds no authorised-location, which every symptom takes",
    },
    {
      name: "a clause seeing a symptom the catalogue does not hold",
      document: { ...EMPTY_DOCUMENT, clauses: [{ clause: "CD-15#loops", sight: { kind: "one-symptom", symptom: "loop-keyword" } }] },
      refusal: "✖ clauses names loop-keyword, which the catalogue does not hold",
    },
    {
      name: "a clause demanding a recipe the catalogue does not hold",
      document: {
        ...EMPTY_DOCUMENT,
        principles: ONE_PLACE_DECIDES_DOCUMENT,
        symptoms: [SYMPTOM_DOCUMENT],
        clauses: [{ clause: "CD-9#result-failures", sight: { kind: "method", recipe: "result-union", outcomeSeenBy: ["work-inside-a-condition"] } }],
      },
      refusal: "✖ clauses names result-union, which the catalogue does not hold",
    },
    {
      name: "a clause demanding a method whose outcome no symptom sees",
      document: { ...EMPTY_DOCUMENT, recipes: [{ name: "result-union", title: "Result union", standing: "accepted" }], clauses: [{ clause: "CD-9#result-failures", sight: { kind: "method", recipe: "result-union", outcomeSeenBy: [] } }] },
      refusal: "✖ Too small: expected array to have >=1 items\n  → at clauses[0].sight.outcomeSeenBy",
    },
    {
      name: "a field the catalogue does not define",
      document: { ...EMPTY_DOCUMENT, numbers: [] },
      refusal: "✖ Unrecognized key: \"numbers\"",
    },
    {
      name: "a version other than 1",
      document: { ...EMPTY_DOCUMENT, version: 2 },
      refusal: "✖ Invalid input: expected 1\n  → at version",
    },
  ])("refuses $name", ({ document, refusal }) => {
    expect(symptomCatalogueOf({ document })).toEqual({ outcome: "failed", error: refusal });
  });
});
