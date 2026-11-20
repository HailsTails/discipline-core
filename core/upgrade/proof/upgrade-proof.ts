import { failureDetailOf } from "../../platform-ports/failure-detail.ts";
import type { RunReport } from "../../report/run-report.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import { type AbsolutePath, absolutePathSchema } from "../../values/absolute-path.ts";
import type { RepoPath } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import type { CheckReport } from "../../verdict/check-report.ts";
import type { CarveOutOracle, OracleFailure } from "../carve-out-oracle/carve-out-oracle.ts";
import { type ProofDifference, proofDifferencesOf } from "../proof-comparison/proof-differences.ts";
import { type PlannedFile, type ProofWriteRefusal, type ProofWritePorts, type ProofWrites, rolledBackProofWrites, type Unrestored, writeProofFiles } from "../proof-writes/proof-writes.ts";
import { type OutsideRoot, type Removed, type RemovalFailure, type RecordsRoot, filesStillPresentOf, recordsOutsideRoot, removedVersionOneFiles, type VersionOneRemoval } from "../proof-writes/version-one-removal.ts";
import type { PlannedRepoFile } from "./planned-repo-file.ts";
import { replacementsOf } from "./projection-replacements.ts";
import type { VersionOneProjection } from "./team-config-finder.ts";
import { type PlanRefusal, type ProjectionFilesOf, type UpgradePlan, upgradePlanOf, type VersionOneReading } from "./upgrade-plan.ts";
import type { ChangedByVersionOne, ProjectionsRefusal, VersionOneProjectionsOf } from "./version-one-projections-reading.ts";

export type ProofRunFailure = { readonly kind: "run-failed"; readonly detail: string };

export type ProofRuns = {
  readonly versionOne: () => Promise<Result<CheckReport, ProofRunFailure>>;
  readonly versionTwo: () => Promise<Result<RunReport, ProofRunFailure>>;
};

export type VersionOneRecordsRoot = { readonly kind: "repository" } | { readonly kind: "folder"; readonly folder: RepoPath };

export type VersionOneFiles = {
  readonly recordsFiles: readonly RepoPath[];
  readonly recordsFolders: readonly RepoPath[];
  readonly recordsRoot: VersionOneRecordsRoot;
  readonly settings: RepoPath;
};

export type UpgradeProofRequest = {
  readonly ports: ProofWritePorts;
  readonly oracle: CarveOutOracle;
  readonly runs: ProofRuns;
  readonly reading: VersionOneReading;
  readonly versionOneFiles: VersionOneFiles;
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly repoRoot: AbsolutePath;
  readonly projectionFilesOf: ProjectionFilesOf;
  readonly versionOneProjectionsOf: VersionOneProjectionsOf;
};

export type ProofCarriedOver = {
  readonly written: readonly RepoPath[];
  readonly replaced: readonly RepoPath[];
  readonly removed: Removed;
};

export type AfterWriting = { readonly written: readonly RepoPath[]; readonly replaced: readonly RepoPath[] };

type Restorable = { readonly unrestored: readonly Unrestored[] };

export type ProofRefusal =
  | { readonly kind: "oracle-failed"; readonly failure: OracleFailure }
  | ({ readonly kind: "plan-refused"; readonly refusal: PlanRefusal } & Restorable)
  | ({ readonly kind: "version-one-run-failed"; readonly failure: ProofRunFailure } & Restorable)
  | ({ readonly kind: "unplaceable-path"; readonly file: RepoPath } & Restorable)
  | ({ readonly kind: "removal-refused"; readonly failure: OutsideRoot } & Restorable)
  | { readonly kind: "write-refused"; readonly refusal: ProofWriteRefusal }
  | { readonly kind: "version-two-run-failed"; readonly failure: ProofRunFailure; readonly unrestored: readonly Unrestored[] }
  | { readonly kind: "differences"; readonly differences: readonly ProofDifference[]; readonly unrestored: readonly Unrestored[] }
  | ({ readonly kind: "removal-failed"; readonly failure: RemovalFailure; readonly remaining: readonly AbsolutePath[] } & AfterWriting);

type Placed = {
  readonly files: readonly PlannedFile[];
  readonly replacements: readonly PlannedFile[];
  readonly replaced: readonly RepoPath[];
  readonly removal: VersionOneRemoval;
};

type PlacedChange = { readonly kind: ChangedByVersionOne["kind"]; readonly path: AbsolutePath };

const unplaceable = (request: { readonly file: RepoPath }): ProofRefusal => ({ kind: "unplaceable-path", file: request.file, unrestored: [] });

const absoluteOf = (request: { readonly ports: ProofWritePorts; readonly repoRoot: AbsolutePath; readonly file: RepoPath }): Result<AbsolutePath, ProofRefusal> => {
  const parsed = absolutePathSchema.safeParse(request.ports.path.join({ segments: [request.repoRoot, request.file] }));
  return parsed.success ? { outcome: "ok", value: parsed.data } : { outcome: "failed", error: unplaceable({ file: request.file }) };
};

const plannedFileOf = (request: { readonly ports: ProofWritePorts; readonly repoRoot: AbsolutePath; readonly planned: PlannedRepoFile }): Result<PlannedFile, ProofRefusal> => {
  const path = absoluteOf({ ...request, file: request.planned.file });
  return path.outcome === "ok" ? { outcome: "ok", value: { path: path.value, text: request.planned.text } } : path;
};

const allOf = <Value>(request: { readonly results: readonly Result<Value, ProofRefusal>[] }): Result<readonly Value[], ProofRefusal> => {
  const failed = request.results.find((settled) => settled.outcome === "failed");
  return failed ?? { outcome: "ok", value: request.results.flatMap((settled) => (settled.outcome === "ok" ? [settled.value] : [])) };
};

const recordsRootOf = (request: UpgradeProofRequest): Result<RecordsRoot, ProofRefusal> => {
  const { ports, repoRoot, versionOneFiles } = request;
  if (versionOneFiles.recordsRoot.kind === "repository") {
    return { outcome: "ok", value: { kind: "repository", path: repoRoot } };
  }
  const folder = absoluteOf({ ports, repoRoot, file: versionOneFiles.recordsRoot.folder });
  return folder.outcome === "ok" ? { outcome: "ok", value: { kind: "folder", path: folder.value } } : folder;
};

const removalOf = (request: UpgradeProofRequest & { readonly projections: readonly VersionOneProjection[] }): Result<VersionOneRemoval, ProofRefusal> => {
  const { ports, repoRoot, versionOneFiles } = request;
  const recordsFiles = allOf({ results: versionOneFiles.recordsFiles.map((file) => absoluteOf({ ports, repoRoot, file })) });
  const recordsFolders = allOf({ results: versionOneFiles.recordsFolders.map((file) => absoluteOf({ ports, repoRoot, file })) });
  const recordsRoot = recordsRootOf(request);
  const projections = allOf({ results: request.projections.map(({ projection }) => absoluteOf({ ports, repoRoot, file: projection })) });
  const settings = absoluteOf({ ports, repoRoot, file: versionOneFiles.settings });
  if (recordsFiles.outcome === "failed") return recordsFiles;
  if (recordsFolders.outcome === "failed") return recordsFolders;
  if (recordsRoot.outcome === "failed") return recordsRoot;
  if (projections.outcome === "failed") return projections;
  if (settings.outcome === "failed") return settings;
  return {
    outcome: "ok",
    value: { recordsFiles: recordsFiles.value, recordsFolders: recordsFolders.value, recordsRoot: recordsRoot.value, projections: projections.value, settings: settings.value },
  };
};

type ToPlace = UpgradeProofRequest & {
  readonly plan: UpgradePlan;
  readonly projections: readonly VersionOneProjection[];
  readonly replacements: readonly PlannedRepoFile[];
};

const placedOf = (request: ToPlace): Result<Placed, ProofRefusal> => {
  const { ports, repoRoot, plan } = request;
  const files = allOf({ results: plan.files.map((planned) => plannedFileOf({ ports, repoRoot, planned })) });
  const replacements = allOf({ results: request.replacements.map((planned) => plannedFileOf({ ports, repoRoot, planned })) });
  const removal = removalOf(request);
  if (files.outcome === "failed") return files;
  if (replacements.outcome === "failed") return replacements;
  if (removal.outcome === "failed") return removal;
  return {
    outcome: "ok",
    value: { files: files.value, replacements: replacements.value, replaced: request.replacements.map(({ file }) => file), removal: removal.value },
  };
};

const changeDetailOf = (request: { readonly kind: ChangedByVersionOne["kind"] }): string =>
  request.kind === "removed" ? "version 1's own project removed it" : "version 1's own project rewrote it";

const placedChangesOf = (request: {
  readonly ports: ProofWritePorts;
  readonly repoRoot: AbsolutePath;
  readonly changed: readonly ChangedByVersionOne[];
}): Result<readonly PlacedChange[], ProofRefusal> =>
  allOf({
    results: request.changed.map(({ kind, path }): Result<PlacedChange, ProofRefusal> => {
      const placed = absoluteOf({ ports: request.ports, repoRoot: request.repoRoot, file: path });
      return placed.outcome === "ok" ? { outcome: "ok", value: { kind, path: placed.value } } : placed;
    }),
  });

const unrestoredByVersionOne = (request: { readonly changes: readonly PlacedChange[] }): readonly Unrestored[] =>
  request.changes.map(({ kind, path }) => ({ written: "file-replaced", path, detail: changeDetailOf({ kind }) }));

const removedByVersionOne = (request: { readonly changes: readonly PlacedChange[] }): readonly AbsolutePath[] =>
  request.changes.flatMap(({ kind, path }) => (kind === "removed" ? [path] : []));

const projectionsRefusalOf = (request: { readonly refusal: ProjectionsRefusal }): ProofRefusal => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "project-failed":
      return { kind: "version-one-run-failed", failure: { kind: "run-failed", detail: refusal.detail }, unrestored: [] };
    case "team-config-refused":
      return { kind: "plan-refused", refusal, unrestored: [] };
    case "slice-left-in-place":
      return { kind: "plan-refused", refusal, unrestored: [] };
  }
};

type Written = {
  readonly plan: UpgradePlan;
  readonly before: CheckReport;
  readonly placed: Placed;
  readonly writes: ProofWrites;
  readonly changes: readonly PlacedChange[];
};

const rolledBackWith = (request: UpgradeProofRequest & Written): readonly Unrestored[] => [
  ...unrestoredByVersionOne({ changes: request.changes }),
  ...rolledBackProofWrites({ ports: request.ports, writes: request.writes }),
];

const comparedAfterWriting = async (request: UpgradeProofRequest & Written): Promise<Result<null, ProofRefusal>> => {
  const after = await request.runs.versionTwo();
  if (after.outcome === "failed") {
    return { outcome: "failed", error: { kind: "version-two-run-failed", failure: after.error, unrestored: rolledBackWith(request) } };
  }
  const differences = proofDifferencesOf({ before: request.before, after: after.value, catalogues: request.catalogues });
  return differences.length > 0
    ? { outcome: "failed", error: { kind: "differences", differences, unrestored: rolledBackWith(request) } }
    : { outcome: "ok", value: null };
};

const comparedOrRolledBack = async (request: UpgradeProofRequest & Written): Promise<Result<null, ProofRefusal>> => {
  try {
    return await comparedAfterWriting(request);
  } catch (thrown: unknown) {
    return {
      outcome: "failed",
      error: { kind: "version-two-run-failed", failure: { kind: "run-failed", detail: failureDetailOf({ thrown }) }, unrestored: rolledBackWith(request) },
    };
  }
};

const removedAfterComparing = (request: UpgradeProofRequest & Written): Result<ProofCarriedOver, ProofRefusal> => {
  const carried: AfterWriting = { written: request.plan.files.map(({ file }) => file), replaced: request.placed.replaced };
  const removed = removedVersionOneFiles({ ports: request.ports, removal: request.placed.removal });
  return removed.outcome === "failed"
    ? { outcome: "failed", error: { kind: "removal-failed", failure: removed.error, remaining: filesStillPresentOf({ removal: request.placed.removal, failure: removed.error }), ...carried } }
    : { outcome: "ok", value: { ...carried, removed: { ...removed.value, files: [...removedByVersionOne({ changes: request.changes }), ...removed.value.files] } } };
};

const writtenAndCompared = async (request: UpgradeProofRequest & Omit<Written, "writes">): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const writes = writeProofFiles({ ports: request.ports, files: request.placed.files, replacements: request.placed.replacements });
  if (writes.outcome === "failed") {
    return { outcome: "failed", error: { kind: "write-refused", refusal: { ...writes.error, unrestored: [...unrestoredByVersionOne({ changes: request.changes }), ...writes.error.unrestored] } } };
  }
  const written: UpgradeProofRequest & Written = { ...request, writes: writes.value };
  const compared = await comparedOrRolledBack(written);
  return compared.outcome === "failed" ? compared : removedAfterComparing(written);
};

const afterProjecting = async (
  request: UpgradeProofRequest & { readonly plan: UpgradePlan; readonly before: CheckReport; readonly projections: readonly VersionOneProjection[]; readonly changes: readonly PlacedChange[] },
): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const replacements = replacementsOf({ projections: request.projections, projected: request.plan.projected });
  if (replacements.outcome === "failed") {
    return { outcome: "failed", error: { kind: "plan-refused", refusal: replacements.error, unrestored: [] } };
  }
  const placed = placedOf({ ...request, replacements: replacements.value });
  if (placed.outcome === "failed") {
    return placed;
  }
  const outside = recordsOutsideRoot({ ports: request.ports, removal: placed.value.removal });
  if (outside !== undefined) {
    return { outcome: "failed", error: { kind: "removal-refused", failure: outside, unrestored: [] } };
  }
  return writtenAndCompared({ ...request, placed: placed.value });
};

const withVersionOneChanges = <Value>(request: {
  readonly result: Result<Value, ProofRefusal>;
  readonly changes: readonly PlacedChange[];
}): Result<Value, ProofRefusal> => {
  if (request.result.outcome === "ok") {
    return request.result;
  }
  const { error } = request.result;
  const unrestored = unrestoredByVersionOne({ changes: request.changes });
  switch (error.kind) {
    case "plan-refused":
    case "version-one-run-failed":
    case "unplaceable-path":
    case "removal-refused":
      return { outcome: "failed", error: { ...error, unrestored: [...unrestored, ...error.unrestored] } };
    case "oracle-failed":
    case "write-refused":
    case "version-two-run-failed":
    case "differences":
    case "removal-failed":
      return request.result;
  }
};

const projectedOver = async (
  request: UpgradeProofRequest & { readonly plan: UpgradePlan; readonly before: CheckReport },
): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const reading = await request.versionOneProjectionsOf();
  const changes = placedChangesOf({ ports: request.ports, repoRoot: request.repoRoot, changed: reading.changed });
  if (changes.outcome === "failed") {
    return changes;
  }
  if (reading.outcome.outcome === "failed") {
    return withVersionOneChanges({ result: { outcome: "failed", error: projectionsRefusalOf({ refusal: reading.outcome.error }) }, changes: changes.value });
  }
  return withVersionOneChanges({ result: await afterProjecting({ ...request, projections: reading.outcome.value, changes: changes.value }), changes: changes.value });
};

export const upgradeProof = async (request: UpgradeProofRequest): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const answered = await request.oracle.answer({ records: request.reading.heads.map(({ record }) => record) });
  if (answered.outcome === "failed") {
    return { outcome: "failed", error: { kind: "oracle-failed", failure: answered.error } };
  }
  const plan = await upgradePlanOf({
    reading: request.reading,
    answered: answered.value,
    catalogues: request.catalogues,
    projectionFilesOf: request.projectionFilesOf,
  });
  if (plan.outcome === "failed") {
    return { outcome: "failed", error: { kind: "plan-refused", refusal: plan.error, unrestored: [] } };
  }
  const before = await request.runs.versionOne();
  if (before.outcome === "failed") {
    return { outcome: "failed", error: { kind: "version-one-run-failed", failure: before.error, unrestored: [] } };
  }
  return projectedOver({ ...request, plan: plan.value, before: before.value });
};
