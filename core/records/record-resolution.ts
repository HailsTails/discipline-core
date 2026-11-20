import type { z } from "zod";
import { type Case, type Pointed, pointedNameOf, type Recipe, type Symptom, type SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import { carriedStandingOf } from "./carried-standing.ts";
import type {
  AuthorisedLocation,
  BoundaryRecord,
  Debt,
  DependencyRecord,
  Deviation,
  HoneRecord,
  OutsideParty,
  RecordRefusal,
  RecordsAtBase,
  RuntimeFacility,
} from "./hone-record.ts";
import { type NamedFolderKind, namedRecordsFileOf, type SingleFileKind } from "./records-layout.ts";
import {
  carriedAuthorisedLocationWireSchema,
  carriedBoundaryRecordWireSchema,
  carriedFormSchema,
  debtWireSchema,
  dependencyRecordWireSchema,
  deviationWireSchema,
  statedAuthorisedLocationWireSchema,
  statedBoundaryRecordWireSchema,
} from "./records-wire.ts";

type Resolution<Value> = Result<Value, readonly RecordRefusal[]>;

export type Resolving = {
  readonly catalogue: SymptomCatalogue;
  readonly base: RecordsAtBase;
  readonly file: RepoPath;
  readonly entry: z.core.util.JSONType;
};

export type FiledUnder = { readonly kind: NamedFolderKind } | { readonly kind: SingleFileKind };

const RUNTIME_PREFIX = "runtime:";

const RUNTIME_FACILITIES: readonly RuntimeFacility[] = ["clock", "random", "process", "json"];

const resolved = <Value>(found: Value): Resolution<Value> => ({ outcome: "ok", value: found });

const refusedWith = (refusal: RecordRefusal): Resolution<never> => ({ outcome: "failed", error: [refusal] });

const refusalsOf = (resolution: Resolution<unknown>): readonly RecordRefusal[] => (resolution.outcome === "failed" ? resolution.error : []);

const formOf = <Output>(request: { readonly schema: z.ZodType<Output>; readonly entry: z.core.util.JSONType }): Resolution<Output> => {
  const parsed = request.schema.safeParse(request.entry);
  return parsed.success ? resolved(parsed.data) : refusedWith({ kind: "form-refused", issues: parsed.error.issues });
};

const carriedForm = (request: { readonly entry: z.core.util.JSONType }): "carried" | "stated" =>
  carriedFormSchema.safeParse(request.entry).success ? "carried" : "stated";

const symptomNamed = (request: { readonly catalogue: SymptomCatalogue; readonly name: string }): Resolution<Symptom> => {
  const symptom = request.catalogue.symptoms.find((candidate) => candidate.name === request.name);
  return symptom === undefined ? refusedWith({ kind: "unknown-symptom", symptom: request.name }) : resolved(symptom);
};

const recipeNamed = (request: { readonly catalogue: SymptomCatalogue; readonly name: string }): Resolution<Recipe> => {
  const recipe = request.catalogue.recipes.find((candidate) => candidate.name === request.name);
  return recipe === undefined ? refusedWith({ kind: "unknown-recipe", recipe: request.name }) : resolved(recipe);
};

const caseNamed = (request: { readonly catalogue: SymptomCatalogue; readonly name: string }): Resolution<Case> => {
  const found = request.catalogue.cases.find((candidate) => candidate.name === request.name);
  return found === undefined ? refusedWith({ kind: "unknown-case", case: request.name }) : resolved(found);
};

export const owedBy = (request: { readonly case: Case; readonly owes: string }): Resolution<Pointed> => {
  const point = request.case.owes.find((candidate) => pointedNameOf({ point: candidate }) === request.owes);
  return point === undefined ? refusedWith({ kind: "owes-not-owed", case: request.case, owes: request.owes }) : resolved(point);
};

const placedIn = (request: { readonly file: RepoPath; readonly belongsIn: RepoPath }): Resolution<RepoPath> =>
  request.file === request.belongsIn ? resolved(request.file) : refusedWith({ kind: "misplaced", belongsIn: request.belongsIn });

const outsidePartyOf = (request: { readonly text: string }): Resolution<OutsideParty> => {
  if (!request.text.startsWith(RUNTIME_PREFIX)) {
    return resolved({ kind: "specifier", specifier: request.text });
  }
  const facility = RUNTIME_FACILITIES.find((candidate) => `${RUNTIME_PREFIX}${candidate}` === request.text);
  return facility === undefined ? refusedWith({ kind: "unknown-runtime-facility", outsideParty: request.text }) : resolved({ kind: "runtime", facility });
};

const symptomFiledAt = (request: Resolving & { readonly kind: NamedFolderKind; readonly symptom: string }): Resolution<Symptom> => {
  const symptom = symptomNamed({ catalogue: request.catalogue, name: request.symptom });
  const placed = placedIn({ file: request.file, belongsIn: namedRecordsFileOf({ kind: request.kind, name: request.symptom }) });
  return symptom.outcome === "failed" || placed.outcome === "failed" ? { outcome: "failed", error: [...refusalsOf(symptom), ...refusalsOf(placed)] } : symptom;
};

const debtHoldingOf = (request: Resolving & { readonly carried: z.core.util.JSONType | undefined }): Resolution<Debt["holding"]> => {
  if (request.carried === undefined) {
    return resolved({ held: "stated" });
  }
  const standing = carriedStandingOf(request);
  return standing.outcome === "failed" ? standing : resolved({ held: "carried", entry: request.carried, lacks: [], standing: standing.value });
};

const debtOf = (request: Resolving): Resolution<Debt> => {
  const form = formOf({ schema: debtWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const { symptom: name, file, note, carried } = form.value;
  const symptom = symptomFiledAt({ ...request, kind: "debt", symptom: name });
  const holding = debtHoldingOf({ ...request, carried });
  if (symptom.outcome === "failed" || holding.outcome === "failed") {
    return { outcome: "failed", error: [...refusalsOf(symptom), ...refusalsOf(holding)] };
  }
  return resolved({ kind: "debt", symptom: symptom.value, file, ...(note === undefined ? {} : { note }), holding: holding.value });
};

const statedAuthorisedLocationOf = (request: Resolving): Resolution<AuthorisedLocation> => {
  const form = formOf({ schema: statedAuthorisedLocationWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const symptom = symptomFiledAt({ ...request, kind: "authorised-locations", symptom: form.value.symptom });
  const found = caseNamed({ catalogue: request.catalogue, name: form.value.case });
  const owes = found.outcome === "failed" ? found : owedBy({ case: found.value, owes: form.value.owes });
  if (symptom.outcome === "failed" || found.outcome === "failed" || owes.outcome === "failed") {
    return { outcome: "failed", error: [...refusalsOf(symptom), ...refusalsOf(owes)] };
  }
  return resolved({
    kind: "authorised-location",
    symptom: symptom.value,
    file: form.value.file,
    holding: { held: "stated", case: found.value, owes: owes.value, whyChain: form.value.whyChain },
  });
};

const carriedAuthorisedLocationOf = (request: Resolving): Resolution<AuthorisedLocation> => {
  const form = formOf({ schema: carriedAuthorisedLocationWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const symptom = symptomFiledAt({ ...request, kind: "authorised-locations", symptom: form.value.symptom });
  const standing = carriedStandingOf(request);
  if (symptom.outcome === "failed" || standing.outcome === "failed") {
    return { outcome: "failed", error: [...refusalsOf(symptom), ...refusalsOf(standing)] };
  }
  return resolved({
    kind: "authorised-location",
    symptom: symptom.value,
    file: form.value.file,
    holding: { held: "carried", entry: form.value.carried, lacks: ["case", "owes", "whyChain"], standing: standing.value },
  });
};

const authorisedLocationOf = (request: Resolving): Resolution<AuthorisedLocation> =>
  carriedForm(request) === "carried" ? carriedAuthorisedLocationOf(request) : statedAuthorisedLocationOf(request);

const statedBoundaryRecordOf = (request: Resolving): Resolution<BoundaryRecord> => {
  const form = formOf({ schema: statedBoundaryRecordWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const { module, outsideParty, ports, conformist } = form.value;
  const party = outsidePartyOf({ text: outsideParty });
  return party.outcome === "failed"
    ? party
    : resolved({ kind: "boundary-record", module, outsideParty: party.value, holding: { held: "stated", ports, ...(conformist === undefined ? {} : { conformist }) } });
};

const carriedBoundaryRecordOf = (request: Resolving): Resolution<BoundaryRecord> => {
  const form = formOf({ schema: carriedBoundaryRecordWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const party = outsidePartyOf({ text: form.value.outsideParty });
  const standing = carriedStandingOf(request);
  if (party.outcome === "failed" || standing.outcome === "failed") {
    return { outcome: "failed", error: [...refusalsOf(party), ...refusalsOf(standing)] };
  }
  return resolved({
    kind: "boundary-record",
    module: form.value.module,
    outsideParty: party.value,
    holding: { held: "carried", entry: form.value.carried, lacks: ["ports"], standing: standing.value },
  });
};

const boundaryRecordOf = (request: Resolving): Resolution<BoundaryRecord> =>
  carriedForm(request) === "carried" ? carriedBoundaryRecordOf(request) : statedBoundaryRecordOf(request);

const recipeReasonHeld = (request: { readonly recipe: Recipe; readonly recipeReason: string }): Resolution<Recipe> =>
  request.recipe.reason.text === request.recipeReason ? resolved(request.recipe) : refusedWith({ kind: "recipe-reason-not-the-catalogues", ...request });

const deviationOf = (request: Resolving): Resolution<Deviation> => {
  const form = formOf({ schema: deviationWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const { recipe: name, file, recipeReason, reasonFails, evidence, ruleHolds } = form.value;
  const found = recipeNamed({ catalogue: request.catalogue, name });
  const recipe = found.outcome === "failed" ? found : recipeReasonHeld({ recipe: found.value, recipeReason });
  const placed = placedIn({ file: request.file, belongsIn: namedRecordsFileOf({ kind: "deviations", name }) });
  if (recipe.outcome === "failed" || placed.outcome === "failed") {
    return { outcome: "failed", error: [...refusalsOf(recipe), ...refusalsOf(placed)] };
  }
  return resolved({ kind: "deviation", recipe: recipe.value, file, reasonFails, evidence, ruleHolds });
};

const dependencyRecordOf = (request: Resolving): Resolution<DependencyRecord> => {
  const form = formOf({ schema: dependencyRecordWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const { dependency, nativeWay, whyNotEnough, peerRisk } = form.value;
  return request.catalogue.namedBans.some((ban) => ban.outsideDependency === dependency)
    ? refusedWith({ kind: "named-ban", dependency })
    : resolved({ kind: "dependency-record", dependency, nativeWay, whyNotEnough, ...(peerRisk === undefined ? {} : { peerRisk }) });
};

export const recordOf = (request: Resolving & { readonly filedUnder: FiledUnder }): Resolution<HoneRecord> => {
  switch (request.filedUnder.kind) {
    case "debt":
      return debtOf(request);
    case "authorised-locations":
      return authorisedLocationOf(request);
    case "deviations":
      return deviationOf(request);
    case "boundaries":
      return boundaryRecordOf(request);
    case "dependencies":
      return dependencyRecordOf(request);
  }
};
