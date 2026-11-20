import type { EngineNotRun, RunProjectionProblem } from "../report/run-report.ts";
import type { Engine, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { EngineRun } from "./engine-run.ts";

type CatalogueEngines = Pick<SymptomCatalogue, "engines">;

const engineOf = (request: { readonly catalogue: CatalogueEngines; readonly mechanism: MechanismId }): Engine =>
  request.catalogue.engines.find((engine) => engine.mechanism === request.mechanism) ?? { name: request.mechanism, mechanism: request.mechanism };

const notRunOf = (request: { readonly catalogue: CatalogueEngines; readonly run: EngineRun }): readonly EngineNotRun[] => {
  const engine = engineOf({ catalogue: request.catalogue, mechanism: request.run.mechanism });
  switch (request.run.projection) {
    case "missing":
      return [{ kind: "engine-not-run", engine, projection: "missing" }];
    case "not-included":
      return [{ kind: "engine-not-run", engine, projection: "not-included", nestedConfigurations: [] }];
    case "none":
    case "current":
    case "out-of-date":
      return [];
  }
};

const projectionProblemOf = (request: { readonly engine: Engine; readonly run: EngineRun }): readonly RunProjectionProblem[] =>
  request.run.projection === "out-of-date" ? [{ scope: "projection", engine: request.engine, state: "out-of-date" }] : [];

const problemOf = (request: { readonly catalogue: CatalogueEngines; readonly run: EngineRun }): readonly RunProjectionProblem[] => {
  const engine = engineOf({ catalogue: request.catalogue, mechanism: request.run.mechanism });
  return [
    ...projectionProblemOf({ engine, run: request.run }),
    ...request.run.slices.map((slice): RunProjectionProblem => ({ scope: "slice", engine, state: slice.state, slice: slice.slice })),
  ];
};

export const engineUnmeasuredOf = (request: { readonly catalogue: CatalogueEngines; readonly runs: readonly EngineRun[] }): readonly EngineNotRun[] =>
  request.runs.flatMap((run) => notRunOf({ catalogue: request.catalogue, run }));

export const engineProblemsOf = (request: { readonly catalogue: CatalogueEngines; readonly runs: readonly EngineRun[] }): readonly RunProjectionProblem[] =>
  request.runs.flatMap((run) => problemOf({ catalogue: request.catalogue, run }));
