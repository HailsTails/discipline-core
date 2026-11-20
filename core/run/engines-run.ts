import type { ProjectedFile } from "../mechanism-port/checks-runner-types.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { RecordsReading } from "../records/hone-record.ts";
import type { RunLoadFailure } from "../report/run-load-failure.ts";
import type { SettingsReading } from "../settings/read-settings.ts";
import type { SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { EslintConfigLookup } from "../values/eslint-config-lookup.ts";
import { gatheredOutcomes, listedOutcome } from "../values/gathered-outcomes.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { ModuleExtension } from "../values/install-layout.ts";
import type { Result } from "../values/result.ts";
import { answeredFilesOf } from "./answered-files.ts";
import { type CheckedTree, typescriptFilesOf } from "./checked-tree-of.ts";
import { type EngineRun, type EngineRunRequest, engineProjectionOf, engineRunOf, loadedEngineOf } from "./engine-run.ts";
import { type RunFailureSource, runFailureOf } from "./run-failure.ts";

export type EnginesRunRequest = {
  readonly catalogue: SymptomCatalogue;
  readonly settings: SettingsReading;
  readonly records: RecordsReading;
  readonly tree: CheckedTree;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly path: Pick<PathPort, "join">;
  readonly modules: ModuleLoaderPort;
};

const mechanismsOf = (request: { readonly settings: SettingsReading }): readonly MechanismId[] => [
  ...new Set(request.settings.selection.bindings.map((binding) => binding.mechanism)),
];

const declaredLookupOf = (request: { readonly settings: SettingsReading }): EslintConfigLookup | undefined => {
  const { eslintConfigLookup } = request.settings;
  return eslintConfigLookup.lookup === "declared" ? eslintConfigLookup.value : undefined;
};

const runRequestOf = (request: EnginesRunRequest): EngineRunRequest => ({
  repoRoot: request.repoRoot,
  installRoot: request.installRoot,
  files: typescriptFilesOf({ tracked: request.tree.tracked }),
  trackedPaths: request.tree.tracked,
  checks: request.catalogue.checks,
  bindings: request.settings.selection.bindings,
  answered: answeredFilesOf({ records: request.records.records }),
  declaredConfigRoots: request.tree.declaredConfigRoots,
  declaredConfigLookup: declaredLookupOf({ settings: request.settings }),
});

const runOf = async (request: EnginesRunRequest & { readonly mechanism: MechanismId }): Promise<Result<EngineRun, RunFailureSource>> => {
  const engine = await loadedEngineOf(request);
  return engine.outcome === "failed" ? engine : engineRunOf({ engine: engine.value, request: runRequestOf(request) });
};

const projectionOf = async (request: EnginesRunRequest & { readonly mechanism: MechanismId }): Promise<Result<readonly ProjectedFile[], RunFailureSource>> => {
  const engine = await loadedEngineOf(request);
  return engine.outcome === "failed" ? engine : engineProjectionOf({ engine: engine.value, request: runRequestOf(request) });
};

export const enginesProjectionOf = async (request: EnginesRunRequest): Promise<Result<readonly ProjectedFile[], RunLoadFailure>> => {
  const projections = await Promise.all(mechanismsOf(request).map((mechanism) => projectionOf({ ...request, mechanism }).then((projected) => listedOutcome({ outcome: projected }))));
  const gathered = gatheredOutcomes({ outcomes: projections });
  return gathered.outcome === "failed"
    ? { outcome: "failed", error: runFailureOf({ engines: request.catalogue.engines, source: gathered.error }) }
    : { outcome: "ok", value: gathered.value.flat() };
};

export const enginesRunOf = async (request: EnginesRunRequest): Promise<Result<readonly EngineRun[], RunLoadFailure>> => {
  const runs = await Promise.all(mechanismsOf(request).map((mechanism) => runOf({ ...request, mechanism }).then((run) => listedOutcome({ outcome: run }))));
  const gathered = gatheredOutcomes({ outcomes: runs });
  return gathered.outcome === "failed" ? { outcome: "failed", error: runFailureOf({ engines: request.catalogue.engines, source: gathered.error }) } : gathered;
};
