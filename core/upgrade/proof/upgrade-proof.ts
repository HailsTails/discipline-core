import type { RunReport } from "../../report/run-report.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import { type AbsolutePath, absolutePathSchema } from "../../values/absolute-path.ts";
import type { RepoPath } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import type { CheckReport } from "../../verdict/check-report.ts";
import type { CarveOutOracle, OracleFailure } from "../carve-out-oracle/carve-out-oracle.ts";
import { type ProofDifference, proofDifferencesOf } from "../proof-comparison/proof-differences.ts";
import { type PlannedFile, type ProofWriteRefusal, type ProofWritePorts, type ProofWrites, rolledBackProofWrites, type Unrestored, writeProofFiles } from "../proof-writes/proof-writes.ts";
import { type OutsideRoot, type Removed, type RemovalFailure, type RecordsRoot, recordsOutsideRoot, removedVersionOneFiles, type VersionOneRemoval } from "../proof-writes/version-one-removal.ts";
import { type PlanRefusal, type PlannedRepoFile, type ProjectionTextOf, type UpgradePlan, upgradePlanOf, type VersionOneReading } from "./upgrade-plan.ts";

export type ProofRunFailure = { readonly kind: "run-failed"; readonly detail: string };

export type ProofRuns = {
  readonly versionOne: () => Promise<Result<CheckReport, ProofRunFailure>>;
  readonly versionTwo: () => Promise<Result<RunReport, ProofRunFailure>>;
};

export type VersionOneRecordsRoot = { readonly kind: "repository" } | { readonly kind: "folder"; readonly folder: RepoPath };

export type VersionOneFiles = {
  readonly recordsFiles: readonly RepoPath[];
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
  readonly versionTwoProjection: RepoPath;
  readonly projectionTextOf: ProjectionTextOf;
};

export type ProofCarriedOver = {
  readonly written: readonly RepoPath[];
  readonly replaced: RepoPath | undefined;
  readonly removed: Removed;
};

export type AfterWriting = { readonly written: readonly RepoPath[]; readonly replaced: RepoPath | undefined };

export type ProofRefusal =
  | { readonly kind: "oracle-failed"; readonly failure: OracleFailure }
  | { readonly kind: "plan-refused"; readonly refusal: PlanRefusal }
  | { readonly kind: "version-one-run-failed"; readonly failure: ProofRunFailure }
  | { readonly kind: "unplaceable-path"; readonly file: RepoPath }
  | { readonly kind: "removal-refused"; readonly failure: OutsideRoot }
  | { readonly kind: "write-refused"; readonly refusal: ProofWriteRefusal }
  | { readonly kind: "version-two-run-failed"; readonly failure: ProofRunFailure; readonly unrestored: readonly Unrestored[] }
  | { readonly kind: "differences"; readonly differences: readonly ProofDifference[]; readonly unrestored: readonly Unrestored[] }
  | ({ readonly kind: "removal-failed"; readonly failure: RemovalFailure } & AfterWriting)
  | ({ readonly kind: "removal-threw"; readonly detail: string } & AfterWriting);

type Placed = {
  readonly files: readonly PlannedFile[];
  readonly replacement: PlannedFile | undefined;
  readonly removal: VersionOneRemoval;
};

const absoluteOf = (request: { readonly ports: ProofWritePorts; readonly repoRoot: AbsolutePath; readonly file: RepoPath }): Result<AbsolutePath, ProofRefusal> => {
  const parsed = absolutePathSchema.safeParse(request.ports.path.join({ segments: [request.repoRoot, request.file] }));
  return parsed.success ? { outcome: "ok", value: parsed.data } : { outcome: "failed", error: { kind: "unplaceable-path", file: request.file } };
};

const plannedFileOf = (request: { readonly ports: ProofWritePorts; readonly repoRoot: AbsolutePath; readonly planned: PlannedRepoFile }): Result<PlannedFile, ProofRefusal> => {
  const path = absoluteOf({ ...request, file: request.planned.file });
  return path.outcome === "ok" ? { outcome: "ok", value: { path: path.value, text: request.planned.text } } : path;
};

const allOf = <Value>(request: { readonly results: readonly Result<Value, ProofRefusal>[] }): Result<readonly Value[], ProofRefusal> => {
  const failed = request.results.find((settled) => settled.outcome === "failed");
  return failed ?? { outcome: "ok", value: request.results.flatMap((settled) => (settled.outcome === "ok" ? [settled.value] : [])) };
};

const optionalPathOf = (request: { readonly ports: ProofWritePorts; readonly repoRoot: AbsolutePath; readonly file: RepoPath | undefined }): Result<AbsolutePath | undefined, ProofRefusal> =>
  request.file === undefined ? { outcome: "ok", value: undefined } : absoluteOf({ ports: request.ports, repoRoot: request.repoRoot, file: request.file });

const recordsRootOf = (request: UpgradeProofRequest): Result<RecordsRoot, ProofRefusal> => {
  const { ports, repoRoot, versionOneFiles } = request;
  if (versionOneFiles.recordsRoot.kind === "repository") {
    return { outcome: "ok", value: { kind: "repository", path: repoRoot } };
  }
  const folder = absoluteOf({ ports, repoRoot, file: versionOneFiles.recordsRoot.folder });
  return folder.outcome === "ok" ? { outcome: "ok", value: { kind: "folder", path: folder.value } } : folder;
};

const removalOf = (request: UpgradeProofRequest): Result<VersionOneRemoval, ProofRefusal> => {
  const { ports, repoRoot, versionOneFiles } = request;
  const recordsFiles = allOf({ results: versionOneFiles.recordsFiles.map((file) => absoluteOf({ ports, repoRoot, file })) });
  const recordsRoot = recordsRootOf(request);
  const projection = optionalPathOf({ ports, repoRoot, file: request.reading.versionOneProjection });
  const settings = absoluteOf({ ports, repoRoot, file: versionOneFiles.settings });
  if (recordsFiles.outcome === "failed") return recordsFiles;
  if (recordsRoot.outcome === "failed") return recordsRoot;
  if (projection.outcome === "failed") return projection;
  if (settings.outcome === "failed") return settings;
  return { outcome: "ok", value: { recordsFiles: recordsFiles.value, recordsRoot: recordsRoot.value, projection: projection.value, settings: settings.value } };
};

const placedOf = (request: UpgradeProofRequest & { readonly plan: UpgradePlan }): Result<Placed, ProofRefusal> => {
  const { ports, repoRoot, plan } = request;
  const files = allOf({ results: plan.files.map((planned) => plannedFileOf({ ports, repoRoot, planned })) });
  const replacement = plan.replacement === undefined ? undefined : plannedFileOf({ ports, repoRoot, planned: plan.replacement });
  const removal = removalOf(request);
  if (files.outcome === "failed") return files;
  if (replacement?.outcome === "failed") return replacement;
  if (removal.outcome === "failed") return removal;
  return { outcome: "ok", value: { files: files.value, replacement: replacement?.value, removal: removal.value } };
};

type Written = {
  readonly plan: UpgradePlan;
  readonly before: CheckReport;
  readonly placed: Placed;
  readonly writes: ProofWrites;
};

const thrownDetailOf = (request: { readonly thrown: unknown }): string => (request.thrown instanceof Error ? request.thrown.message : String(request.thrown));

const rolledBackWith = (request: UpgradeProofRequest & Written): readonly Unrestored[] => rolledBackProofWrites({ ports: request.ports, writes: request.writes });

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
      error: { kind: "version-two-run-failed", failure: { kind: "run-failed", detail: thrownDetailOf({ thrown }) }, unrestored: rolledBackWith(request) },
    };
  }
};

const removedAfterComparing = (request: UpgradeProofRequest & Written): Result<ProofCarriedOver, ProofRefusal> => {
  const carried: AfterWriting = { written: request.plan.files.map(({ file }) => file), replaced: request.plan.replacement?.file };
  try {
    const removed = removedVersionOneFiles({ ports: request.ports, removal: request.placed.removal });
    return removed.outcome === "failed"
      ? { outcome: "failed", error: { kind: "removal-failed", failure: removed.error, ...carried } }
      : { outcome: "ok", value: { ...carried, removed: removed.value } };
  } catch (thrown: unknown) {
    return { outcome: "failed", error: { kind: "removal-threw", detail: thrownDetailOf({ thrown }), ...carried } };
  }
};

export const upgradeProof = async (request: UpgradeProofRequest): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const answered = await request.oracle.answer({ records: request.reading.heads.map(({ record }) => record) });
  if (answered.outcome === "failed") {
    return { outcome: "failed", error: { kind: "oracle-failed", failure: answered.error } };
  }
  const plan = upgradePlanOf({
    reading: request.reading,
    answered: answered.value,
    catalogues: request.catalogues,
    versionTwoProjection: request.versionTwoProjection,
    projectionTextOf: request.projectionTextOf,
  });
  if (plan.outcome === "failed") {
    return { outcome: "failed", error: { kind: "plan-refused", refusal: plan.error } };
  }
  const before = await request.runs.versionOne();
  if (before.outcome === "failed") {
    return { outcome: "failed", error: { kind: "version-one-run-failed", failure: before.error } };
  }
  const placed = placedOf({ ...request, plan: plan.value });
  if (placed.outcome === "failed") {
    return placed;
  }
  const outside = recordsOutsideRoot({ ports: request.ports, removal: placed.value.removal });
  if (outside !== undefined) {
    return { outcome: "failed", error: { kind: "removal-refused", failure: outside } };
  }
  const writes = writeProofFiles({ ports: request.ports, files: placed.value.files, replacement: placed.value.replacement });
  if (writes.outcome === "failed") {
    return { outcome: "failed", error: { kind: "write-refused", refusal: writes.error } };
  }
  const written: UpgradeProofRequest & Written = { ...request, plan: plan.value, before: before.value, placed: placed.value, writes: writes.value };
  const compared = await comparedOrRolledBack(written);
  return compared.outcome === "failed" ? compared : removedAfterComparing(written);
};
