import type { RunReport } from "../../report/run-report.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import { type AbsolutePath, absolutePathSchema } from "../../values/absolute-path.ts";
import type { RepoPath } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import type { CheckReport } from "../../verdict/check-report.ts";
import type { CarveOutOracle, OracleFailure } from "../carve-out-oracle/carve-out-oracle.ts";
import { type ProofDifference, proofDifferencesOf } from "../proof-comparison/proof-differences.ts";
import { type PlannedFile, type ProofWriteRefusal, type ProofWritePorts, type ProofWrites, rolledBackProofWrites, type Unrestored, writeProofFiles } from "../proof-writes/proof-writes.ts";
import { type Removed, type RemovalFailure, removedVersionOneFiles, type VersionOneRemoval } from "../proof-writes/version-one-removal.ts";
import { type PlanRefusal, type PlannedRepoFile, type ProjectionTextOf, type UpgradePlan, upgradePlanOf, type VersionOneReading } from "./upgrade-plan.ts";

export type ProofRunFailure = { readonly kind: "run-failed"; readonly detail: string };

export type ProofRuns = {
  readonly versionOne: () => Promise<Result<CheckReport, ProofRunFailure>>;
  readonly versionTwo: () => Promise<Result<RunReport, ProofRunFailure>>;
};

export type VersionOneFiles = {
  readonly recordsFiles: readonly RepoPath[];
  readonly recordsRoot: RepoPath;
  readonly projection: RepoPath | undefined;
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

export type ProofRefusal =
  | { readonly kind: "oracle-failed"; readonly failure: OracleFailure }
  | { readonly kind: "plan-refused"; readonly refusal: PlanRefusal }
  | { readonly kind: "version-one-run-failed"; readonly failure: ProofRunFailure }
  | { readonly kind: "unplaceable-path"; readonly file: RepoPath }
  | { readonly kind: "write-refused"; readonly refusal: ProofWriteRefusal }
  | { readonly kind: "version-two-run-failed"; readonly failure: ProofRunFailure; readonly unrestored: readonly Unrestored[] }
  | { readonly kind: "differences"; readonly differences: readonly ProofDifference[]; readonly unrestored: readonly Unrestored[] }
  | { readonly kind: "removal-failed"; readonly failure: RemovalFailure };

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

const removalOf = (request: UpgradeProofRequest): Result<VersionOneRemoval, ProofRefusal> => {
  const { ports, repoRoot, versionOneFiles } = request;
  const recordsFiles = allOf({ results: versionOneFiles.recordsFiles.map((file) => absoluteOf({ ports, repoRoot, file })) });
  const recordsRoot = absoluteOf({ ports, repoRoot, file: versionOneFiles.recordsRoot });
  const projection = optionalPathOf({ ports, repoRoot, file: versionOneFiles.projection });
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

const comparedAfterWriting = async (request: UpgradeProofRequest & {
  readonly plan: UpgradePlan;
  readonly before: CheckReport;
  readonly placed: Placed;
  readonly writes: ProofWrites;
}): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const after = await request.runs.versionTwo();
  if (after.outcome === "failed") {
    return { outcome: "failed", error: { kind: "version-two-run-failed", failure: after.error, unrestored: rolledBackProofWrites({ ports: request.ports, writes: request.writes }) } };
  }
  const differences = proofDifferencesOf({ before: request.before, after: after.value, catalogues: request.catalogues });
  if (differences.length > 0) {
    return { outcome: "failed", error: { kind: "differences", differences, unrestored: rolledBackProofWrites({ ports: request.ports, writes: request.writes }) } };
  }
  const removed = removedVersionOneFiles({ ports: request.ports, removal: request.placed.removal });
  return removed.outcome === "failed"
    ? { outcome: "failed", error: { kind: "removal-failed", failure: removed.error } }
    : {
        outcome: "ok",
        value: { written: request.plan.files.map(({ file }) => file), replaced: request.plan.replacement?.file, removed: removed.value },
      };
};

export const upgradeProof = async (request: UpgradeProofRequest): Promise<Result<ProofCarriedOver, ProofRefusal>> => {
  const answered = await request.oracle.answer({ records: request.reading.records });
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
  const writes = writeProofFiles({ ports: request.ports, files: placed.value.files, replacement: placed.value.replacement });
  return writes.outcome === "failed"
    ? { outcome: "failed", error: { kind: "write-refused", refusal: writes.error } }
    : comparedAfterWriting({ ...request, plan: plan.value, before: before.value, placed: placed.value, writes: writes.value });
};
