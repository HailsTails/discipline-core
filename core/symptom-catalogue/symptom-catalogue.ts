import { z } from "zod";
import type { Finding } from "../governance/governance.ts";
import type { Remedy } from "../mechanism-port/runner-result-types.ts";
import type { Branded } from "../values/branded.ts";
import { brandedTextSchema } from "../values/branded-schema.ts";
import { type ClauseAddress, sameClauseAddress } from "../values/clause-address.ts";
import type { Equal } from "../values/type-equality.ts";

export type SymptomName = Branded<string, "SymptomName">;
export type RuleName = Branded<string, "RuleName">;
export type PrincipleName = Branded<string, "PrincipleName">;
export type RecipeName = Branded<string, "RecipeName">;

export type Standing = "accepted" | "proposed";

export type RecordKindName = "authorised-location" | "deviation" | "debt" | "boundary-record" | "dependency-record";

export type TodaysRecordFormat = "authorised-location" | "file-carve-out" | "none-yet";

export type Pointed =
  | { readonly kind: "rule"; readonly name: RuleName }
  | { readonly kind: "principle"; readonly name: PrincipleName };

export type Indication = { readonly case: string; readonly points: readonly Pointed[] };

export type RecordAnswer = { readonly kind: RecordKindName; readonly when: string };

export type Symptom = {
  readonly name: SymptomName;
  readonly title: string;
  readonly seen: string;
  readonly mayIndicate: readonly Indication[];
  readonly breachUsuallySits: string;
  readonly recipes: readonly RecipeName[];
  readonly answeredBy: readonly RecordAnswer[];
};

export type FormSight = { readonly section: string; readonly symptom: SymptomName };

export type ClauseSight =
  | { readonly kind: "one-symptom"; readonly symptom: SymptomName }
  | { readonly kind: "symptom-by-form"; readonly forms: readonly FormSight[] }
  | { readonly kind: "method"; readonly recipe: RecipeName; readonly outcomeSeenBy: readonly SymptomName[] }
  | { readonly kind: "outside-the-cases" };

export type CataloguedClause = { readonly clause: ClauseAddress; readonly sight: ClauseSight };

export type Principle = { readonly name: PrincipleName; readonly title: string };

export type Rule = { readonly name: RuleName; readonly title: string; readonly principle: PrincipleName; readonly standing: Standing };

export type Recipe = { readonly name: RecipeName; readonly title: string; readonly standing: Standing };

export type RecordKind = { readonly name: RecordKindName; readonly title: string; readonly todaysFormat: TodaysRecordFormat };

export type SymptomCatalogue = {
  readonly principles: readonly Principle[];
  readonly rules: readonly Rule[];
  readonly recipes: readonly Recipe[];
  readonly recordKinds: readonly RecordKind[];
  readonly symptoms: readonly Symptom[];
  readonly clauses: readonly CataloguedClause[];
};

export type SymptomReading =
  | { readonly reading: "named"; readonly symptom: Symptom }
  | { readonly reading: "sees-no-symptom" }
  | { readonly reading: "not-in-catalogue" };

export const EMPTY_SYMPTOM_CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  recipes: [],
  recordKinds: [],
  symptoms: [],
  clauses: [],
};

const CATALOGUE_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const NOT_A_CATALOGUE_NAME = "is not a lower-case hyphenated name";

const isSymptomName = (text: string): text is SymptomName => CATALOGUE_NAME_PATTERN.test(text);
const isRuleName = (text: string): text is RuleName => CATALOGUE_NAME_PATTERN.test(text);
const isPrincipleName = (text: string): text is PrincipleName => CATALOGUE_NAME_PATTERN.test(text);
const isRecipeName = (text: string): text is RecipeName => CATALOGUE_NAME_PATTERN.test(text);

const catalogueNameText = z.string().regex(CATALOGUE_NAME_PATTERN, { error: NOT_A_CATALOGUE_NAME });

export const symptomNameSchema = brandedTextSchema({ text: catalogueNameText, isBranded: isSymptomName, refusal: NOT_A_CATALOGUE_NAME });
export const ruleNameSchema = brandedTextSchema({ text: catalogueNameText, isBranded: isRuleName, refusal: NOT_A_CATALOGUE_NAME });
export const principleNameSchema = brandedTextSchema({ text: catalogueNameText, isBranded: isPrincipleName, refusal: NOT_A_CATALOGUE_NAME });
export const recipeNameSchema = brandedTextSchema({ text: catalogueNameText, isBranded: isRecipeName, refusal: NOT_A_CATALOGUE_NAME });

export const isSymptomNameSchemaEqual: Equal<z.output<typeof symptomNameSchema>, SymptomName> = true;
export const isRuleNameSchemaEqual: Equal<z.output<typeof ruleNameSchema>, RuleName> = true;
export const isPrincipleNameSchemaEqual: Equal<z.output<typeof principleNameSchema>, PrincipleName> = true;
export const isRecipeNameSchemaEqual: Equal<z.output<typeof recipeNameSchema>, RecipeName> = true;

type SightedSymptom =
  | { readonly sighted: "symptom"; readonly name: SymptomName }
  | { readonly sighted: "none" }
  | { readonly sighted: "uncatalogued-form" };

const formSymptomOf = (request: {
  readonly forms: readonly FormSight[];
  readonly remedy: Remedy | undefined;
}): SightedSymptom => {
  const form = request.forms.find((candidate) => candidate.section === request.remedy?.section);
  return form === undefined ? { sighted: "uncatalogued-form" } : { sighted: "symptom", name: form.symptom };
};

const sightedSymptomOf = (request: { readonly sight: ClauseSight; readonly remedy: Remedy | undefined }): SightedSymptom => {
  switch (request.sight.kind) {
    case "one-symptom":
      return { sighted: "symptom", name: request.sight.symptom };
    case "symptom-by-form":
      return formSymptomOf({ forms: request.sight.forms, remedy: request.remedy });
    case "method":
    case "outside-the-cases":
      return { sighted: "none" };
  }
};

const NOT_IN_CATALOGUE: SymptomReading = { reading: "not-in-catalogue" };

const namedReadingOf = (request: { readonly catalogue: SymptomCatalogue; readonly name: SymptomName }): SymptomReading => {
  const symptom = request.catalogue.symptoms.find((candidate) => candidate.name === request.name);
  return symptom === undefined ? NOT_IN_CATALOGUE : { reading: "named", symptom };
};

export const symptomReadingOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly finding: Pick<Finding, "clause" | "remedy">;
}): SymptomReading => {
  const catalogued = request.catalogue.clauses.find(
    (entry) => sameClauseAddress({ left: entry.clause, right: request.finding.clause }) === "same",
  );
  if (catalogued === undefined) {
    return NOT_IN_CATALOGUE;
  }
  const sighted = sightedSymptomOf({ sight: catalogued.sight, remedy: request.finding.remedy });
  switch (sighted.sighted) {
    case "symptom":
      return namedReadingOf({ catalogue: request.catalogue, name: sighted.name });
    case "none":
      return { reading: "sees-no-symptom" };
    case "uncatalogued-form":
      return NOT_IN_CATALOGUE;
  }
};
