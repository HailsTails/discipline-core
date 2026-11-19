import { z } from "zod";
import { clauseAddressSchema, clauseAddressText } from "../values/clause-address.ts";
import type { Result } from "../values/result.ts";
import {
  type Pointed,
  principleNameSchema,
  recipeNameSchema,
  ruleNameSchema,
  type SymptomCatalogue,
  symptomNameSchema,
} from "./symptom-catalogue.ts";

const SUPPORTED_VERSION = 1;

const textSchema = z.string().min(1);

const standingSchema = z.enum(["accepted", "proposed"]);

const recordKindNameSchema = z.enum(["authorised-location", "deviation", "debt", "boundary-record", "dependency-record"]);

const pointedWireSchema = z.union([
  z.strictObject({ rule: ruleNameSchema }),
  z.strictObject({ principle: principleNameSchema }),
]);

const symptomWireSchema = z.strictObject({
  name: symptomNameSchema,
  title: textSchema,
  seen: textSchema,
  mayIndicate: z.array(z.strictObject({ case: textSchema, points: z.array(pointedWireSchema).min(1) })).min(1),
  breachUsuallySits: textSchema,
  recipes: z.array(recipeNameSchema),
  answeredBy: z.array(z.strictObject({ kind: recordKindNameSchema, when: textSchema })).min(1),
});

const sightWireSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("one-symptom"), symptom: symptomNameSchema }),
  z.strictObject({
    kind: z.literal("symptom-by-form"),
    forms: z.array(z.strictObject({ section: textSchema, symptom: symptomNameSchema })).min(1),
  }),
  z.strictObject({ kind: z.literal("method"), recipe: recipeNameSchema, outcomeSeenBy: z.array(symptomNameSchema).min(1) }),
  z.strictObject({ kind: z.literal("outside-the-cases") }),
]);

const catalogueFileSchema = z.strictObject({
  version: z.literal(SUPPORTED_VERSION),
  principles: z.array(z.strictObject({ name: principleNameSchema, title: textSchema })),
  rules: z.array(z.strictObject({ name: ruleNameSchema, title: textSchema, principle: principleNameSchema, standing: standingSchema })),
  recipes: z.array(z.strictObject({ name: recipeNameSchema, title: textSchema, standing: standingSchema })),
  recordKinds: z.array(
    z.strictObject({ name: recordKindNameSchema, title: textSchema, todaysFormat: z.enum(["authorised-location", "file-carve-out", "none-yet"]) }),
  ),
  symptoms: z.array(symptomWireSchema),
  clauses: z.array(z.strictObject({ clause: clauseAddressSchema, sight: sightWireSchema })),
});

type CatalogueFile = z.infer<typeof catalogueFileSchema>;

type PointedWire = z.infer<typeof pointedWireSchema>;

type SightWire = z.infer<typeof sightWireSchema>;

const repeatsIn = (request: { readonly listing: string; readonly names: readonly string[] }): readonly string[] =>
  request.names
    .filter((name, index) => request.names.indexOf(name) !== index)
    .map((name) => `${request.listing} holds ${name} more than once`);

const unknownsIn = (request: {
  readonly listing: string;
  readonly named: readonly string[];
  readonly known: readonly string[];
}): readonly string[] =>
  request.named
    .filter((name) => !request.known.includes(name))
    .map((name) => `${request.listing} names ${name}, which the catalogue does not hold`);

const pointedRulesOf = (request: { readonly points: readonly PointedWire[] }): readonly string[] =>
  request.points.flatMap((point) => ("rule" in point ? [point.rule] : []));

const pointedPrinciplesOf = (request: { readonly points: readonly PointedWire[] }): readonly string[] =>
  request.points.flatMap((point) => ("principle" in point ? [point.principle] : []));

const pointsOf = (request: { readonly file: CatalogueFile }): readonly PointedWire[] =>
  request.file.symptoms.flatMap((symptom) => symptom.mayIndicate.flatMap((indication) => indication.points));

const sightedSymptomsOf = (request: { readonly sight: SightWire }): readonly string[] => {
  switch (request.sight.kind) {
    case "one-symptom":
      return [request.sight.symptom];
    case "symptom-by-form":
      return request.sight.forms.map((form) => form.symptom);
    case "method":
      return request.sight.outcomeSeenBy;
    case "outside-the-cases":
      return [];
  }
};

const sightRecipesOf = (request: { readonly sight: SightWire }): readonly string[] =>
  request.sight.kind === "method" ? [request.sight.recipe] : [];

const formSectionRepeatsOf = (request: { readonly file: CatalogueFile }): readonly string[] =>
  request.file.clauses.flatMap(({ clause, sight }) =>
    sight.kind === "symptom-by-form"
      ? repeatsIn({ listing: `the forms of ${clauseAddressText({ address: clause })}`, names: sight.forms.map((form) => form.section) })
      : [],
  );

const repeatedNamesOf = (request: { readonly file: CatalogueFile }): readonly string[] => [
  ...repeatsIn({ listing: "principles", names: request.file.principles.map((principle) => principle.name) }),
  ...repeatsIn({ listing: "rules", names: request.file.rules.map((rule) => rule.name) }),
  ...repeatsIn({ listing: "recipes", names: request.file.recipes.map((recipe) => recipe.name) }),
  ...repeatsIn({ listing: "recordKinds", names: request.file.recordKinds.map((kind) => kind.name) }),
  ...repeatsIn({ listing: "symptoms", names: request.file.symptoms.map((symptom) => symptom.name) }),
  ...repeatsIn({ listing: "clauses", names: request.file.clauses.map(({ clause }) => clauseAddressText({ address: clause })) }),
  ...formSectionRepeatsOf(request),
];

const unknownNamesOf = (request: { readonly file: CatalogueFile }): readonly string[] => {
  const { file } = request;
  const points = pointsOf(request);
  const sights = file.clauses.map(({ sight }) => sight);
  return [
    ...unknownsIn({ listing: "rules", named: file.rules.map((rule) => rule.principle), known: file.principles.map((principle) => principle.name) }),
    ...unknownsIn({ listing: "symptoms", named: pointedRulesOf({ points }), known: file.rules.map((rule) => rule.name) }),
    ...unknownsIn({ listing: "symptoms", named: pointedPrinciplesOf({ points }), known: file.principles.map((principle) => principle.name) }),
    ...unknownsIn({ listing: "symptoms", named: file.symptoms.flatMap((symptom) => symptom.recipes), known: file.recipes.map((recipe) => recipe.name) }),
    ...unknownsIn({
      listing: "symptoms",
      named: file.symptoms.flatMap((symptom) => symptom.answeredBy.map((answer) => answer.kind)),
      known: file.recordKinds.map((kind) => kind.name),
    }),
    ...unknownsIn({ listing: "clauses", named: sights.flatMap((sight) => sightedSymptomsOf({ sight })), known: file.symptoms.map((symptom) => symptom.name) }),
    ...unknownsIn({ listing: "clauses", named: sights.flatMap((sight) => sightRecipesOf({ sight })), known: file.recipes.map((recipe) => recipe.name) }),
  ];
};

const checkedCatalogueFileSchema = catalogueFileSchema.superRefine((file, context) => {
  [...repeatedNamesOf({ file }), ...unknownNamesOf({ file })].forEach((message) => {
    context.addIssue({ code: "custom", message });
  });
});

const pointedOf = (request: { readonly point: PointedWire }): Pointed =>
  "rule" in request.point ? { kind: "rule", name: request.point.rule } : { kind: "principle", name: request.point.principle };

const catalogueOf = (request: { readonly file: CatalogueFile }): SymptomCatalogue => ({
  principles: request.file.principles,
  rules: request.file.rules,
  recipes: request.file.recipes,
  recordKinds: request.file.recordKinds,
  symptoms: request.file.symptoms.map((symptom) => ({
    ...symptom,
    mayIndicate: symptom.mayIndicate.map((indication) => ({
      case: indication.case,
      points: indication.points.map((point) => pointedOf({ point })),
    })),
  })),
  clauses: request.file.clauses,
});

export const symptomCatalogueOf = (request: { readonly document: unknown }): Result<SymptomCatalogue, string> => {
  const parsed = checkedCatalogueFileSchema.safeParse(request.document);
  return parsed.success
    ? { outcome: "ok", value: catalogueOf({ file: parsed.data }) }
    : { outcome: "failed", error: z.prettifyError(parsed.error) };
};
