import type { LoadFailure } from "../core/check/load-failure.ts";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import { type DisciplineFile, readDisciplineFile } from "../core/rule-set-reader/rule-set-reader.ts";
import type { SymptomCatalogue } from "../core/symptom-catalogue/symptom-catalogue.ts";
import { type CatalogueGuide, symptomNoteLineOf } from "../core/verdict/symptom-notes.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { clauseAddressText } from "../core/values/clause-address.ts";
import { disciplineIdSchema } from "../core/values/identifiers.ts";
import type { Result } from "../core/values/result.ts";

export type CatalogueCoverage = {
  readonly uncatalogued: readonly string[];
  readonly unknown: readonly string[];
  readonly unreadable: readonly LoadFailure[];
};

type DisciplineSource = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
};

const disciplineFileIn = (request: DisciplineSource & { readonly folder: string }): Result<DisciplineFile, LoadFailure> => {
  const discipline = disciplineIdSchema.safeParse(request.folder);
  return discipline.success
    ? readDisciplineFile({ ...request, discipline: discipline.data })
    : { outcome: "failed", error: { kind: "unknown-discipline", address: request.folder } };
};

const definedClausesOf = (request: { readonly discipline: DisciplineFile }): readonly string[] =>
  request.discipline.clauses.map((clause) => `${request.discipline.id}#${clause.id}`);

export const catalogueCoverageOf = (
  request: DisciplineSource & { readonly catalogue: SymptomCatalogue; readonly disciplines: readonly string[] },
): CatalogueCoverage => {
  const readings = request.disciplines.map((folder) => disciplineFileIn({ ...request, folder }));
  const defined = readings.flatMap((reading) => (reading.outcome === "ok" ? definedClausesOf({ discipline: reading.value }) : []));
  const catalogued = request.catalogue.clauses.map(({ clause }) => clauseAddressText({ address: clause }));
  return {
    uncatalogued: defined.filter((address) => !catalogued.includes(address)),
    unknown: catalogued.filter((address) => !defined.includes(address)),
    unreadable: readings.flatMap((reading) => (reading.outcome === "failed" ? [reading.error] : [])),
  };
};

export const formSectionsOf = (request: { readonly catalogue: SymptomCatalogue; readonly clause: string }): readonly string[] =>
  request.catalogue.clauses
    .filter(({ clause }) => clauseAddressText({ address: clause }) === request.clause)
    .flatMap(({ sight }) => (sight.kind === "symptom-by-form" ? sight.forms.map((form) => form.section) : []));

export const symptomNamesOf = (request: { readonly catalogue: SymptomCatalogue }): readonly string[] =>
  request.catalogue.symptoms.map((symptom) => symptom.name);

export const correctUseNotesOf = (request: { readonly guide: CatalogueGuide }): readonly string[] =>
  request.guide.catalogue.symptoms
    .filter((symptom) => symptom.correctUses.length > 0)
    .map((symptom) => symptomNoteLineOf({ ...request.guide, symptom }));