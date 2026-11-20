import type { Symptom, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { BoundaryRecord, Deviation, HoneRecord, OutsideParty, RuntimeFacility } from "./hone-record.ts";
import { banStandingOf, dependencyOf } from "./outside-dependency.ts";

export type PartyReport = { readonly reported: "specifier"; readonly specifier: string } | { readonly reported: "not-reported" };

export type Site = { readonly symptom: Symptom; readonly file: RepoPath; readonly party: PartyReport };

export type Holding = "holds" | "does-not-hold";

const FOLDER_SEPARATOR = "/";

const IMPORTED_PARTY_SYMPTOMS: readonly string[] = ["outside-import-past-a-boundary", "library-class-built-in-place", "outside-type-in-a-signature"];

const RUNTIME_REACH: Readonly<Record<RuntimeFacility, readonly string[]>> = {
  clock: ["date-used-directly"],
  random: ["ambient-randomness"],
  process: ["process-global-used-in-place"],
  json: ["text-past-its-reader"],
};

const everyHolds = (request: { readonly holdings: readonly Holding[] }): Holding =>
  request.holdings.every((holding) => holding === "holds") ? "holds" : "does-not-hold";

const sameName = (request: { readonly left: string; readonly right: string }): Holding => (request.left === request.right ? "holds" : "does-not-hold");

const namedIn = (request: { readonly name: string; readonly names: readonly string[] }): Holding => (request.names.includes(request.name) ? "holds" : "does-not-hold");

const reachesSymptom = (request: { readonly held: Symptom; readonly symptom: Symptom }): Holding => sameName({ left: request.held.name, right: request.symptom.name });

const reachOf = (request: { readonly party: OutsideParty }): readonly string[] => {
  switch (request.party.kind) {
    case "package":
    case "scheme-module":
      return IMPORTED_PARTY_SYMPTOMS;
    case "runtime":
      return RUNTIME_REACH[request.party.facility];
  }
};

const moduleCovers = (request: { readonly module: RepoPath; readonly file: RepoPath }): Holding =>
  request.file === request.module || request.file.startsWith(`${request.module}${FOLDER_SEPARATOR}`) ? "holds" : "does-not-hold";

const recipeOfSymptom = (request: { readonly record: Deviation; readonly symptom: Symptom }): Holding =>
  request.symptom.recipes.some((recipe) => recipe.name === request.record.recipe.name) ? "holds" : "does-not-hold";

const importedPartyClearOfBans = (request: { readonly party: PartyReport; readonly catalogue: SymptomCatalogue }): Holding => {
  switch (request.party.reported) {
    case "not-reported":
      return "does-not-hold";
    case "specifier":
      return banStandingOf({ namedBans: request.catalogue.namedBans, dependency: dependencyOf({ specifier: request.party.specifier }) }) === "banned"
        ? "does-not-hold"
        : "holds";
  }
};

const deviationClearOfBans = (request: { readonly site: Site; readonly catalogue: SymptomCatalogue }): Holding =>
  namedIn({ name: request.site.symptom.name, names: IMPORTED_PARTY_SYMPTOMS }) === "holds" ? importedPartyClearOfBans({ party: request.site.party, catalogue: request.catalogue }) : "holds";

const reportedPartyIs = (request: { readonly party: OutsideParty; readonly specifier: string }): Holding => {
  switch (request.party.kind) {
    case "package":
      return sameName({ left: dependencyOf({ specifier: request.specifier }), right: request.party.dependency });
    case "scheme-module":
      return sameName({ left: request.specifier, right: request.party.specifier });
    case "runtime":
      return "does-not-hold";
  }
};

const boundaryPartyNamed = (request: { readonly record: BoundaryRecord; readonly site: Site }): Holding => {
  if (request.record.outsideParty.kind === "runtime") {
    return "holds";
  }
  switch (request.site.party.reported) {
    case "not-reported":
      return "does-not-hold";
    case "specifier":
      return reportedPartyIs({ party: request.record.outsideParty, specifier: request.site.party.specifier });
  }
};

export const overlapsAt = (request: { readonly record: HoneRecord; readonly symptom: Symptom; readonly file: RepoPath }): Holding => {
  const { record, symptom, file } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return everyHolds({ holdings: [reachesSymptom({ held: record.symptom, symptom }), sameName({ left: record.file, right: file })] });
    case "deviation":
      return everyHolds({ holdings: [sameName({ left: record.file, right: file }), recipeOfSymptom({ record, symptom })] });
    case "boundary-record":
      return everyHolds({ holdings: [moduleCovers({ module: record.module, file }), namedIn({ name: symptom.name, names: reachOf({ party: record.outsideParty }) })] });
    case "dependency-record":
      return "does-not-hold";
  }
};

const partyHolds = (request: { readonly record: HoneRecord; readonly site: Site; readonly catalogue: SymptomCatalogue }): Holding => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
    case "dependency-record":
      return "holds";
    case "deviation":
      return deviationClearOfBans(request);
    case "boundary-record":
      return boundaryPartyNamed({ record, site: request.site });
  }
};

export const holdsAt = (request: { readonly record: HoneRecord; readonly site: Site; readonly catalogue: SymptomCatalogue }): Holding =>
  everyHolds({ holdings: [overlapsAt({ record: request.record, symptom: request.site.symptom, file: request.site.file }), partyHolds(request)] });
