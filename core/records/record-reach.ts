import type { FoundCheck } from "../symptom-catalogue/check-address.ts";
import type { Symptom, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { AuthorisedReach, BoundaryRecord, Debt, Deviation, HoneRecord, OutsideParty, RuntimeFacility, SymptomReach } from "./hone-record.ts";
import { banStandingOf, dependencyOf } from "./outside-dependency.ts";

export type PartyReport = { readonly reported: "specifier"; readonly specifier: string } | { readonly reported: "not-reported" };

export type Site = { readonly symptom: Symptom; readonly check: FoundCheck; readonly file: RepoPath; readonly party: PartyReport };

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

const reachesCheck = (request: { readonly reach: AuthorisedReach; readonly check: FoundCheck }): Holding => {
  const { reach, check } = request;
  switch (reach.reaches) {
    case "whole-symptom":
      return "holds";
    case "one-check":
      return check.found === "check" ? sameName({ left: check.check.name, right: reach.check.name }) : "does-not-hold";
    case "unknown-check":
      return "does-not-hold";
  }
};

const reachesSymptom = (request: { readonly symptom: Symptom; readonly reach: AuthorisedReach; readonly site: Site }): Holding =>
  everyHolds({ holdings: [sameName({ left: request.symptom.name, right: request.site.symptom.name }), reachesCheck({ reach: request.reach, check: request.site.check })] });

const reachCovers = (request: { readonly wider: AuthorisedReach; readonly narrower: SymptomReach }): Holding => {
  const { wider, narrower } = request;
  switch (narrower.reaches) {
    case "whole-symptom":
      return wider.reaches === "whole-symptom" ? "holds" : "does-not-hold";
    case "one-check":
      return reachesCheck({ reach: wider, check: { found: "check", check: narrower.check } });
  }
};

const clearOfOutsideParties = (request: { readonly symptom: Symptom }): Holding =>
  namedIn({ name: request.symptom.name, names: IMPORTED_PARTY_SYMPTOMS }) === "holds" ? "does-not-hold" : "holds";

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
  clearOfOutsideParties({ symptom: request.site.symptom }) === "holds" ? "holds" : importedPartyClearOfBans({ party: request.site.party, catalogue: request.catalogue });

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

const sitedAt = (request: { readonly record: HoneRecord; readonly site: Site }): Holding => {
  const { record, site } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return everyHolds({ holdings: [reachesSymptom({ symptom: record.symptom, reach: record.reach, site }), sameName({ left: record.file, right: site.file })] });
    case "deviation":
      return everyHolds({ holdings: [sameName({ left: record.file, right: site.file }), recipeOfSymptom({ record, symptom: site.symptom })] });
    case "boundary-record":
      return everyHolds({
        holdings: [moduleCovers({ module: record.module, file: site.file }), namedIn({ name: site.symptom.name, names: reachOf({ party: record.outsideParty }) })],
      });
    case "dependency-record":
      return "does-not-hold";
  }
};

const runtimeBoundaryCovers = (request: { readonly record: BoundaryRecord; readonly debt: Debt }): Holding => {
  const party = request.record.outsideParty;
  switch (party.kind) {
    case "package":
    case "scheme-module":
      return "does-not-hold";
    case "runtime":
      return everyHolds({
        holdings: [moduleCovers({ module: request.record.module, file: request.debt.file }), namedIn({ name: request.debt.symptom.name, names: RUNTIME_REACH[party.facility] })],
      });
  }
};

export const coversDebt = (request: { readonly record: HoneRecord; readonly debt: Debt }): Holding => {
  const { record, debt } = request;
  switch (record.kind) {
    case "debt":
    case "dependency-record":
      return "does-not-hold";
    case "authorised-location":
      return everyHolds({
        holdings: [
          sameName({ left: record.symptom.name, right: debt.symptom.name }),
          reachCovers({ wider: record.reach, narrower: debt.reach }),
          sameName({ left: record.file, right: debt.file }),
        ],
      });
    case "deviation":
      return everyHolds({
        holdings: [sameName({ left: record.file, right: debt.file }), recipeOfSymptom({ record, symptom: debt.symptom }), clearOfOutsideParties({ symptom: debt.symptom })],
      });
    case "boundary-record":
      return runtimeBoundaryCovers({ record, debt });
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
  everyHolds({ holdings: [sitedAt({ record: request.record, site: request.site }), partyHolds(request)] });
