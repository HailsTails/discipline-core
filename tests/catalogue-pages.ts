import type { Recipe, RecipeReason, Standing, SymptomCatalogue } from "../core/symptom-catalogue/symptom-catalogue.ts";

export type PageCase = { readonly title: string; readonly standing: Standing };

export type PageReason = { readonly title: string; readonly reason: RecipeReason };

const CASE_ROW = /^\| (.+?) \| .+? \| .* \|$/;

const NOT_A_CASE_TITLE = new Set(["Case", "---"]);

type CaseReading = { readonly standing: Standing; readonly within: "cases" | "outside"; readonly cases: readonly PageCase[] };

const caseReadingAfter = (reading: CaseReading, line: string): CaseReading => {
  if (reading.within === "outside" || line.startsWith("## Outside the cases")) {
    return { ...reading, within: "outside" };
  }
  if (line.startsWith("### Proposed cases")) {
    return { ...reading, standing: "proposed" };
  }
  const title = CASE_ROW.exec(line)?.[1];
  return title === undefined || NOT_A_CASE_TITLE.has(title) ? reading : { ...reading, cases: [...reading.cases, { title, standing: reading.standing }] };
};

export const casesOnCasesPage = (request: { readonly text: string }): readonly PageCase[] =>
  request.text.split("\n").reduce<CaseReading>(caseReadingAfter, { standing: "accepted", within: "cases", cases: [] }).cases;

export const casesOfCatalogue = (request: { readonly catalogue: Pick<SymptomCatalogue, "cases"> }): readonly PageCase[] =>
  request.catalogue.cases.map((entry) => ({ title: entry.title, standing: entry.standing }));

const INDICATION_LINE = /^- \*\*May indicate:\*\* (.+)$/;

const TEST_QUALIFIER = "In a test: ";

const caseSpellingsBefore = (request: { readonly indications: string }): readonly string[] =>
  request.indications
    .split(" → ")
    .slice(0, -1)
    .map((before) => before.split(/\. |; /).at(-1) ?? before)
    .map((spelling) => (spelling.startsWith(TEST_QUALIFIER) ? spelling.slice(TEST_QUALIFIER.length) : spelling));

const pageSpellingsOf = (request: { readonly cases: readonly PageCase[] }): readonly string[] =>
  request.cases
    .map((entry) => (entry.standing === "proposed" ? `${entry.title} (proposed)` : entry.title))
    .toSorted((left, right) => right.length - left.length);

const unlistedRestOf = (request: { readonly rest: string; readonly spellings: readonly string[] }): string => {
  if (request.rest === "") {
    return "";
  }
  const known = request.spellings.find((spelling) => request.rest === spelling || request.rest.startsWith(`${spelling}, `));
  return known === undefined ? request.rest : unlistedRestOf({ ...request, rest: request.rest.slice(known.length).replace(/^, /, "") });
};

export const unlistedCaseNamesOn = (request: { readonly symptomsPage: string; readonly cases: readonly PageCase[] }): readonly string[] => {
  const spellings = pageSpellingsOf(request);
  return request.symptomsPage
    .split("\n")
    .flatMap((line) => {
      const indications = INDICATION_LINE.exec(line)?.[1];
      return indications === undefined ? [] : caseSpellingsBefore({ indications });
    })
    .filter((spelling) => unlistedRestOf({ rest: spelling, spellings }) !== "");
};

const SERVED_LINE = /^- \*\*Cases served:\*\* (.+)\.$/;

const WOULD_SERVE_LINE = /^- \*\*Case it would serve:\*\* \[(.+?)\]/;

const servedSpellingsOn = (request: { readonly line: string }): readonly string[] => {
  const served = SERVED_LINE.exec(request.line)?.[1];
  const wouldServe = WOULD_SERVE_LINE.exec(request.line)?.[1];
  return [...(served === undefined ? [] : served.split("; ")), ...(wouldServe === undefined ? [] : [wouldServe])];
};

export const unservedCaseNamesOn = (request: { readonly rulesPage: string; readonly cases: readonly PageCase[] }): readonly string[] => {
  const titles = request.cases.map((entry) => entry.title);
  return request.rulesPage
    .split("\n")
    .flatMap((line) => servedSpellingsOn({ line }))
    .filter((spelling) => !titles.includes(spelling));
};

const RECIPE_HEADING =/^#{3,4} (.+)$/;

const REASON_LINE = /^- \*\*Chosen because( \(proposed\))?:\*\* (.+)$/;

type ReasonReading = { readonly title: string | undefined; readonly reasons: readonly PageReason[] };

const reasonReadingAfter = (reading: ReasonReading, line: string): ReasonReading => {
  const heading = RECIPE_HEADING.exec(line)?.[1];
  if (heading !== undefined) {
    return { ...reading, title: heading.trim() };
  }
  const reason = REASON_LINE.exec(line);
  const text = reason?.[2];
  if (reading.title === undefined || reason === null || text === undefined) {
    return reading;
  }
  const standing: Standing = reason[1] === undefined ? "accepted" : "proposed";
  return { title: undefined, reasons: [...reading.reasons, { title: reading.title, reason: { text, standing } }] };
};

export const recipeReasonsOnPage = (request: { readonly text: string }): readonly PageReason[] =>
  request.text.split("\n").reduce<ReasonReading>(reasonReadingAfter, { title: undefined, reasons: [] }).reasons;

const reasonFitOf = (request: { readonly recipe: Recipe; readonly page: readonly PageReason[] }): "fits" | "differs" => {
  const onPage = request.page.find((entry) => entry.title === request.recipe.title);
  return onPage !== undefined && onPage.reason.text === request.recipe.reason.text && onPage.reason.standing === request.recipe.reason.standing
    ? "fits"
    : "differs";
};

export const proposedReasonsOf = (request: { readonly recipes: readonly Recipe[] }): readonly string[] =>
  request.recipes.filter((recipe) => recipe.reason.standing === "proposed").map((recipe) => recipe.name);

export const reasonMismatchesOf = (request: { readonly recipes: readonly Recipe[]; readonly page: readonly PageReason[] }): readonly string[] =>
  request.recipes.filter((recipe) => reasonFitOf({ recipe, page: request.page }) === "differs").map((recipe) => recipe.name);
