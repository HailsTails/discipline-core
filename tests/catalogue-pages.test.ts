import { describe, expect, it } from "vitest";
import type { Recipe, SymptomCatalogue } from "../core/symptom-catalogue/symptom-catalogue.ts";
import {
  casesOfCatalogue,
  casesOnCasesPage,
  type PageCase,
  proposedReasonsOf,
  reasonMismatchesOf,
  recipeReasonsOnPage,
  unlistedCaseNamesOn,
  unservedCaseNamesOn,
} from "./catalogue-pages.ts";

const CASES_PAGE = `# Cases

## No hidden effects

| Case | Owes | What to do |
|---|---|---|
| Makes a new value from what it has | Effects; One place | It returns a new value. |
| Causes an effect (writes, logs, sends, exits) | Effects; Boundary, One place | The effect is a call on a port. |

### Proposed cases

| Case | Owes | What to do |
|---|---|---|
| Ships code for others | Outside risk | What we ship is visible. |

## Outside the cases

| Case | Owes | What to do |
|---|---|---|
| Not a case | Nothing | Nothing. |
`;

const PAGE_CASES: readonly PageCase[] = [
  { title: "Makes a new value from what it has", standing: "accepted" },
  { title: "Causes an effect (writes, logs, sends, exits)", standing: "accepted" },
  { title: "Ships code for others", standing: "proposed" },
];

describe("casesOnCasesPage", () => {
  it("reads each case row's title and standing, up to the cases outside the model", () => {
    expect(casesOnCasesPage({ text: CASES_PAGE })).toEqual([
      { title: "Makes a new value from what it has", standing: "accepted" },
      { title: "Causes an effect (writes, logs, sends, exits)", standing: "accepted" },
      { title: "Ships code for others", standing: "proposed" },
    ]);
  });
});

describe("unlistedCaseNamesOn", () => {
  it("names nothing when every case before an arrow is on the cases page, a proposed one marked proposed, past a test qualifier", () => {
    expect(
      unlistedCaseNamesOn({
        symptomsPage:
          "- **May indicate:** Makes a new value from what it has, Causes an effect (writes, logs, sends, exits) → Ports declared inside; Written-out answers. In a test: Makes a new value from what it has → Straight-through tests (\"quoted.\").\n- **May indicate:** Ships code for others (proposed) → Shipped risk declared (proposed, not accepted).\n- **Seen:** Makes a value → nothing.\n",
        cases: PAGE_CASES,
      }),
    ).toEqual([]);
  });

  it("names each spelling before an arrow that is not a case on the cases page", () => {
    expect(
      unlistedCaseNamesOn({
        symptomsPage:
          "- **May indicate:** Makes a new value, Causes an effect (writes, logs, sends, exits) → Ports declared inside. Causes an effect → Written-out answers; Makes a new value from what it has (proposed) → One place decides.\n",
        cases: PAGE_CASES,
      }),
    ).toEqual(["Makes a new value, Causes an effect (writes, logs, sends, exits)", "Causes an effect", "Makes a new value from what it has (proposed)"]);
  });
});

describe("unservedCaseNamesOn", () => {
  it("names nothing when every case a rule serves, or would serve, is on the cases page", () => {
    expect(
      unservedCaseNamesOn({
        rulesPage:
          "### Ports declared inside\n\n- **Cases served:** Makes a new value from what it has; Causes an effect (writes, logs, sends, exits).\n\n### Shipped risk declared\n\n- **Case it would serve:** [Ships code for others](cases.md#proposed-cases) (proposed): what we ship is visible.\n",
        cases: PAGE_CASES,
      }),
    ).toEqual([]);
  });

  it("names each served case spelled otherwise than the cases page spells it", () => {
    expect(
      unservedCaseNamesOn({
        rulesPage: "- **Cases served:** Makes a new value; Causes an effect (writes, logs, sends, exits).\n- **Case it would serve:** [Ships code](cases.md#proposed-cases) (proposed).\n",
        cases: PAGE_CASES,
      }),
    ).toEqual(["Makes a new value", "Ships code"]);
  });
});

const RECIPES_PAGE = `# Recipes

## Tests

### Stub with vi.fn

- **Use:** a double.
- **Chosen because:** "Stubs return written-out values."

#### Composition root

- **Chosen because (proposed):** "One place builds."
`;

describe("recipeReasonsOnPage", () => {
  it("reads each recipe heading's reason and whether the page marks it proposed", () => {
    expect(recipeReasonsOnPage({ text: RECIPES_PAGE })).toEqual([
      { title: "Stub with vi.fn", reason: { text: "\"Stubs return written-out values.\"", standing: "accepted" } },
      { title: "Composition root", reason: { text: "\"One place builds.\"", standing: "proposed" } },
    ]);
  });
});

const STUB_WITH_VIFN: Recipe = {
  name: "stub-with-vifn",
  title: "Stub with vi.fn",
  standing: "accepted",
  reason: { text: "\"Stubs return written-out values.\"", standing: "accepted" },
};

const COMPOSITION_ROOT: Recipe = {
  name: "composition-root",
  title: "Composition root",
  standing: "accepted",
  reason: { text: "\"One place builds.\"", standing: "proposed" },
};

describe("reasonMismatchesOf", () => {
  it("names nothing when each recipe's reason and its standing are the page's", () => {
    expect(reasonMismatchesOf({ recipes: [STUB_WITH_VIFN, COMPOSITION_ROOT], page: recipeReasonsOnPage({ text: RECIPES_PAGE }) })).toEqual([]);
  });

  it("names a recipe whose reason is presented as settled where the page proposes it, one whose words differ, and one the page has no reason for", () => {
    expect(
      reasonMismatchesOf({
        recipes: [
          { ...COMPOSITION_ROOT, reason: { text: "\"One place builds.\"", standing: "accepted" } },
          { ...STUB_WITH_VIFN, reason: { text: "\"Stubs are simple.\"", standing: "accepted" } },
          { ...STUB_WITH_VIFN, name: "guard-clauses", title: "Guard clauses" },
        ],
        page: recipeReasonsOnPage({ text: RECIPES_PAGE }),
      }),
    ).toEqual(["composition-root", "stub-with-vifn", "guard-clauses"]);
  });
});

describe("proposedReasonsOf", () => {
  it("names each recipe whose reason is proposed, in catalogue order", () => {
    expect(proposedReasonsOf({ recipes: [STUB_WITH_VIFN, COMPOSITION_ROOT] })).toEqual(["composition-root"]);
  });
});

describe("casesOfCatalogue", () => {
  it("lists each catalogued case's title and standing in catalogue order", () => {
    const catalogue: Pick<SymptomCatalogue, "cases"> = {
      cases: [
        { name: "ships-code-for-others", title: "Ships code for others", standing: "proposed", owes: [] },
        { name: "makes-a-new-value-from-what-it-has", title: "Makes a new value from what it has", standing: "accepted", owes: [] },
      ],
    };
    expect(casesOfCatalogue({ catalogue })).toEqual([
      { title: "Ships code for others", standing: "proposed" },
      { title: "Makes a new value from what it has", standing: "accepted" },
    ]);
  });
});
