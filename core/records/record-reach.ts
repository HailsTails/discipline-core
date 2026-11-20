import type { Symptom, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { BoundaryRecord, Deviation, HoneRecord, OutsideParty, RuntimeFacility } from "./hone-record.ts";
import { banStandingOf, dependencyOf } from "./outside-dependency.ts";

export type RaisedBy = { readonly kind: "import"; readonly specifier: string } | { readonly kind: "not-an-import" };

export type Site = { readonly symptom: Symptom; readonly file: RepoPath; readonly raisedBy: RaisedBy };

export type Holding = "holds" | "does-not-hold";

const FOLDER_SEPARATOR = "/";

const IMPORTED_PARTY_REACH: readonly string[] = ["outside-import-past-a-boundary", "library-class-built-in-place", "outside-type-in-a-signature"];

const RUNTIME_REACH: Readonly<Record<RuntimeFacility, readonly string[]>> = {
  clock: ["date-used-directly"],
  random: ["ambient-randomness"],
  process: ["process-global-used-in-place"],
  json: [],
};

const everyHolds = (request: { readonly holdings: readonly Holding[] }): Holding =>
  request.holdings.every((holding) => holding === "holds") ? "holds" : "does-not-hold";

const sameName = (request: { readonly left: string; readonly right: string }): Holding => (request.left === request.right ? "holds" : "does-not-hold");

const reachOf = (request: { readonly party: OutsideParty }): readonly string[] => {
  switch (request.party.kind) {
    case "package":
    case "built-in":
      return IMPORTED_PARTY_REACH;
    case "runtime":
      return RUNTIME_REACH[request.party.facility];
  }
};

const moduleCovers = (request: { readonly module: RepoPath; readonly file: RepoPath }): Holding =>
  request.file === request.module || request.file.startsWith(`${request.module}${FOLDER_SEPARATOR}`) ? "holds" : "does-not-hold";

const clearOfBans = (request: { readonly raisedBy: RaisedBy; readonly catalogue: SymptomCatalogue }): Holding => {
  switch (request.raisedBy.kind) {
    case "not-an-import":
      return "holds";
    case "import":
      return banStandingOf({ namedBans: request.catalogue.namedBans, dependency: dependencyOf({ specifier: request.raisedBy.specifier }) }) === "banned"
        ? "does-not-hold"
        : "holds";
  }
};

const recipeOfSymptom = (request: { readonly record: Deviation; readonly site: Site }): Holding =>
  request.site.symptom.recipes.some((recipe) => recipe.name === request.record.recipe.name) ? "holds" : "does-not-hold";

const withinReach = (request: { readonly record: BoundaryRecord; readonly site: Site }): Holding =>
  reachOf({ party: request.record.outsideParty }).includes(request.site.symptom.name) ? "holds" : "does-not-hold";

const deviationHolds = (request: { readonly record: Deviation; readonly site: Site; readonly catalogue: SymptomCatalogue }): Holding =>
  everyHolds({
    holdings: [
      sameName({ left: request.record.file, right: request.site.file }),
      recipeOfSymptom(request),
      clearOfBans({ raisedBy: request.site.raisedBy, catalogue: request.catalogue }),
    ],
  });

const boundaryRecordHolds = (request: { readonly record: BoundaryRecord; readonly site: Site }): Holding =>
  everyHolds({ holdings: [moduleCovers({ module: request.record.module, file: request.site.file }), withinReach(request)] });

export const holdsAt = (request: { readonly record: HoneRecord; readonly site: Site; readonly catalogue: SymptomCatalogue }): Holding => {
  const { record, site } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return everyHolds({ holdings: [sameName({ left: record.symptom.name, right: site.symptom.name }), sameName({ left: record.file, right: site.file })] });
    case "deviation":
      return deviationHolds({ record, site, catalogue: request.catalogue });
    case "boundary-record":
      return boundaryRecordHolds({ record, site });
    case "dependency-record":
      return "does-not-hold";
  }
};
