import { z } from "zod";
import { clauseAddressSchema, clauseAddressText } from "../values/clause-address.ts";
import type { Result } from "../values/result.ts";
import type {
  AlwaysRecordable,
  CataloguedClause,
  ClauseSight,
  CorrectUse,
  FormSight,
  Indication,
  Pointed,
  Principle,
  Recipe,
  RecordKind,
  Rule,
  Symptom,
  SymptomCatalogue,
} from "./symptom-catalogue.ts";

const SUPPORTED_VERSION = 1;

const NOT_A_CATALOGUE_NAME = "is not a lower-case hyphenated name";

const catalogueNameSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, { error: NOT_A_CATALOGUE_NAME });

const textSchema = z.string().min(1);

const standingSchema = z.enum(["accepted", "proposed"]);

const recordKindNameSchema = z.enum(["authorised-location", "deviation", "debt", "boundary-record", "dependency-record"]);

const pointedWireSchema = z.union([z.strictObject({ rule: catalogueNameSchema }), z.strictObject({ principle: catalogueNameSchema })]);

const correctUseWireSchema = z.strictObject({ situation: textSchema, kind: recordKindNameSchema, at: textSchema.optional() });

const symptomWireSchema = z.strictObject({
  name: catalogueNameSchema,
  title: textSchema,
  seen: textSchema,
  mayIndicate: z.array(z.strictObject({ case: textSchema, points: z.array(pointedWireSchema).min(1) })).min(1),
  breachUsuallySits: textSchema,
  recipes: z.array(catalogueNameSchema),
  correctUses: z.array(correctUseWireSchema),
});

const sightWireSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("one-symptom"), symptom: catalogueNameSchema }),
  z.strictObject({
    kind: z.literal("symptom-by-form"),
    forms: z.array(z.strictObject({ section: textSchema, symptom: catalogueNameSchema })).min(1),
  }),
  z.strictObject({ kind: z.literal("method"), recipe: catalogueNameSchema, outcomeSeenBy: z.array(catalogueNameSchema).min(1) }),
  z.strictObject({ kind: z.literal("outside-the-cases") }),
]);

const recordKindWireSchema = z.strictObject({
  name: recordKindNameSchema,
  title: textSchema,
  phrase: textSchema,
  todaysFormat: z.enum(["authorised-location", "file-carve-out", "none-yet"]),
});

const catalogueFileSchema = z.strictObject({
  version: z.literal(SUPPORTED_VERSION),
  principles: z.array(z.strictObject({ name: catalogueNameSchema, title: textSchema })),
  rules: z.array(z.strictObject({ name: catalogueNameSchema, title: textSchema, principle: catalogueNameSchema, standing: standingSchema })),
  recipes: z.array(z.strictObject({ name: catalogueNameSchema, title: textSchema, standing: standingSchema })),
  recordKinds: z.array(recordKindWireSchema),
  symptoms: z.array(symptomWireSchema),
  clauses: z.array(z.strictObject({ clause: clauseAddressSchema, sight: sightWireSchema })),
});

type CatalogueFile = z.infer<typeof catalogueFileSchema>;

type PrincipleWire = CatalogueFile["principles"][number];

type RuleWire = CatalogueFile["rules"][number];

type RecipeWire = CatalogueFile["recipes"][number];

type RecordKindWire = z.infer<typeof recordKindWireSchema>;

type SymptomWire = z.infer<typeof symptomWireSchema>;

type PointedWire = z.infer<typeof pointedWireSchema>;

type CorrectUseWire = z.infer<typeof correctUseWireSchema>;

type SightWire = z.infer<typeof sightWireSchema>;

type Resolution<Value> = Result<Value, readonly string[]>;

const resolved = <Value>(found: Value): Resolution<Value> => ({ outcome: "ok", value: found });

const faultsOf = <Value>(resolution: Resolution<Value>): readonly string[] => (resolution.outcome === "failed" ? resolution.error : []);

const allResolved = <Value>(resolutions: readonly Resolution<Value>[]): Resolution<readonly Value[]> => {
  const faults = resolutions.flatMap(faultsOf);
  return faults.length > 0
    ? { outcome: "failed", error: faults }
    : resolved(resolutions.flatMap((resolution) => (resolution.outcome === "ok" ? [resolution.value] : [])));
};

const mapped = <From, To>(request: { readonly resolution: Resolution<From>; readonly to: (from: From) => To }): Resolution<To> =>
  request.resolution.outcome === "failed" ? request.resolution : resolved(request.to(request.resolution.value));

const entryNamed = <Entry extends { readonly name: string }>(request: {
  readonly entries: readonly Entry[];
  readonly name: string;
  readonly refusal: string;
}): Resolution<Entry> => {
  const entry = request.entries.find((candidate) => candidate.name === request.name);
  return entry === undefined ? { outcome: "failed", error: [request.refusal] } : resolved(entry);
};

const heldEntryNamed = <Entry extends { readonly name: string }>(request: {
  readonly listing: string;
  readonly entries: readonly Entry[];
  readonly name: string;
}): Resolution<Entry> =>
  entryNamed({ ...request, refusal: `${request.listing} names ${request.name}, which the catalogue does not hold` });

type Definitions = {
  readonly principles: readonly Principle[];
  readonly rules: readonly Rule[];
  readonly recipes: readonly Recipe[];
  readonly recordKinds: readonly RecordKind[];
  readonly alwaysRecordable: AlwaysRecordable;
};

const principleOf = (wire: PrincipleWire): Principle => ({ name: wire.name, title: wire.title });

const recipeOf = (wire: RecipeWire): Recipe => ({ name: wire.name, title: wire.title, standing: wire.standing });

const recordKindOf = (wire: RecordKindWire): RecordKind => ({
  name: wire.name,
  title: wire.title,
  phrase: wire.phrase,
  todaysFormat: wire.todaysFormat,
});

const ruleOf = (request: { readonly wire: RuleWire; readonly principles: readonly Principle[] }): Resolution<Rule> =>
  mapped({
    resolution: heldEntryNamed({ listing: "rules", entries: request.principles, name: request.wire.principle }),
    to: (principle) => ({ name: request.wire.name, title: request.wire.title, principle, standing: request.wire.standing }),
  });

const alwaysRecordableKindOf = (request: { readonly recordKinds: readonly RecordKind[]; readonly name: string }): Resolution<RecordKind> =>
  entryNamed({ entries: request.recordKinds, name: request.name, refusal: `recordKinds holds no ${request.name}, which every symptom takes` });

const alwaysRecordableOf = (request: { readonly recordKinds: readonly RecordKind[] }): Resolution<AlwaysRecordable> => {
  const debt = alwaysRecordableKindOf({ ...request, name: "debt" });
  const authorisedLocation = alwaysRecordableKindOf({ ...request, name: "authorised-location" });
  return debt.outcome === "failed" || authorisedLocation.outcome === "failed"
    ? { outcome: "failed", error: [...faultsOf(debt), ...faultsOf(authorisedLocation)] }
    : resolved({ debt: debt.value, authorisedLocation: authorisedLocation.value });
};

const definitionsOf = (request: { readonly file: CatalogueFile }): Resolution<Definitions> => {
  const principles = request.file.principles.map(principleOf);
  const recordKinds = request.file.recordKinds.map(recordKindOf);
  const rules = allResolved(request.file.rules.map((wire) => ruleOf({ wire, principles })));
  const alwaysRecordable = alwaysRecordableOf({ recordKinds });
  return rules.outcome === "failed" || alwaysRecordable.outcome === "failed"
    ? { outcome: "failed", error: [...faultsOf(rules), ...faultsOf(alwaysRecordable)] }
    : resolved({ principles, rules: rules.value, recipes: request.file.recipes.map(recipeOf), recordKinds, alwaysRecordable: alwaysRecordable.value });
};

const pointedOf = (request: { readonly point: PointedWire; readonly definitions: Definitions }): Resolution<Pointed> =>
  "rule" in request.point
    ? mapped({
        resolution: heldEntryNamed({ listing: "symptoms", entries: request.definitions.rules, name: request.point.rule }),
        to: (rule): Pointed => ({ kind: "rule", rule }),
      })
    : mapped({
        resolution: heldEntryNamed({ listing: "symptoms", entries: request.definitions.principles, name: request.point.principle }),
        to: (principle): Pointed => ({ kind: "principle", principle }),
      });

const indicationOf = (request: { readonly indication: SymptomWire["mayIndicate"][number]; readonly definitions: Definitions }): Resolution<Indication> =>
  mapped({
    resolution: allResolved(request.indication.points.map((point) => pointedOf({ point, definitions: request.definitions }))),
    to: (points) => ({ case: request.indication.case, points }),
  });

const correctUseOf = (request: { readonly use: CorrectUseWire; readonly definitions: Definitions }): Resolution<CorrectUse> =>
  mapped({
    resolution: heldEntryNamed({ listing: "symptoms", entries: request.definitions.recordKinds, name: request.use.kind }),
    to: (kind): CorrectUse =>
      request.use.at === undefined ? { situation: request.use.situation, kind } : { situation: request.use.situation, kind, at: request.use.at },
  });

const symptomOf = (request: { readonly wire: SymptomWire; readonly definitions: Definitions }): Resolution<Symptom> => {
  const { wire, definitions } = request;
  const mayIndicate = allResolved(wire.mayIndicate.map((indication) => indicationOf({ indication, definitions })));
  const recipes = allResolved(wire.recipes.map((name) => heldEntryNamed({ listing: "symptoms", entries: definitions.recipes, name })));
  const correctUses = allResolved(wire.correctUses.map((use) => correctUseOf({ use, definitions })));
  if (mayIndicate.outcome === "failed" || recipes.outcome === "failed" || correctUses.outcome === "failed") {
    return { outcome: "failed", error: [...faultsOf(mayIndicate), ...faultsOf(recipes), ...faultsOf(correctUses)] };
  }
  return resolved({
    name: wire.name,
    title: wire.title,
    seen: wire.seen,
    mayIndicate: mayIndicate.value,
    breachUsuallySits: wire.breachUsuallySits,
    recipes: recipes.value,
    correctUses: correctUses.value,
  });
};

type Sighting = { readonly symptoms: readonly Symptom[]; readonly recipes: readonly Recipe[] };

const sightedSymptomOf = (request: Sighting & { readonly name: string }): Resolution<Symptom> =>
  heldEntryNamed({ listing: "clauses", entries: request.symptoms, name: request.name });

const methodSightOf = (request: Sighting & { readonly sight: Extract<SightWire, { readonly kind: "method" }> }): Resolution<ClauseSight> => {
  const recipe = heldEntryNamed({ listing: "clauses", entries: request.recipes, name: request.sight.recipe });
  const outcomeSeenBy = allResolved(request.sight.outcomeSeenBy.map((name) => sightedSymptomOf({ ...request, name })));
  return recipe.outcome === "failed" || outcomeSeenBy.outcome === "failed"
    ? { outcome: "failed", error: [...faultsOf(recipe), ...faultsOf(outcomeSeenBy)] }
    : resolved({ kind: "method", recipe: recipe.value, outcomeSeenBy: outcomeSeenBy.value });
};

const sightOf = (request: Sighting & { readonly sight: SightWire }): Resolution<ClauseSight> => {
  const { sight } = request;
  switch (sight.kind) {
    case "one-symptom":
      return mapped({ resolution: sightedSymptomOf({ ...request, name: sight.symptom }), to: (symptom): ClauseSight => ({ kind: "one-symptom", symptom }) });
    case "symptom-by-form":
      return mapped({
        resolution: allResolved(
          sight.forms.map((form) =>
            mapped({ resolution: sightedSymptomOf({ ...request, name: form.symptom }), to: (symptom): FormSight => ({ section: form.section, symptom }) }),
          ),
        ),
        to: (forms): ClauseSight => ({ kind: "symptom-by-form", forms }),
      });
    case "method":
      return methodSightOf({ ...request, sight });
    case "outside-the-cases":
      return resolved({ kind: "outside-the-cases" });
  }
};

const clauseOf = (request: Sighting & { readonly wire: CatalogueFile["clauses"][number] }): Resolution<CataloguedClause> =>
  mapped({ resolution: sightOf({ ...request, sight: request.wire.sight }), to: (sight) => ({ clause: request.wire.clause, sight }) });

const catalogueOf = (request: { readonly file: CatalogueFile }): Resolution<SymptomCatalogue> => {
  const definitions = definitionsOf(request);
  if (definitions.outcome === "failed") {
    return definitions;
  }
  const symptoms = allResolved(request.file.symptoms.map((wire) => symptomOf({ wire, definitions: definitions.value })));
  if (symptoms.outcome === "failed") {
    return symptoms;
  }
  const sighting: Sighting = { symptoms: symptoms.value, recipes: definitions.value.recipes };
  return mapped({
    resolution: allResolved(request.file.clauses.map((wire) => clauseOf({ ...sighting, wire }))),
    to: (clauses) => ({ ...definitions.value, symptoms: symptoms.value, clauses }),
  });
};

const repeatsIn = (request: { readonly listing: string; readonly names: readonly string[] }): readonly string[] =>
  request.names
    .filter((name, index) => request.names.indexOf(name) !== index)
    .map((name) => `${request.listing} holds ${name} more than once`);

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

const checkedCatalogueFileSchema = catalogueFileSchema.superRefine((file, context) => {
  repeatedNamesOf({ file }).forEach((message) => {
    context.addIssue({ code: "custom", message });
  });
});

const refusalText = (request: { readonly faults: readonly string[] }): string => request.faults.map((fault) => `✖ ${fault}`).join("\n");

export const symptomCatalogueOf = (request: { readonly document: unknown }): Result<SymptomCatalogue, string> => {
  const parsed = checkedCatalogueFileSchema.safeParse(request.document);
  if (!parsed.success) {
    return { outcome: "failed", error: z.prettifyError(parsed.error) };
  }
  const catalogue = catalogueOf({ file: parsed.data });
  return catalogue.outcome === "failed" ? { outcome: "failed", error: refusalText({ faults: catalogue.error }) } : catalogue;
};
