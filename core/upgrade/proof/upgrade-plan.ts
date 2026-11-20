import type { ConsumerSelectionFile } from "../../consumer-selection/selection-file.ts";
import { recordsTextOf } from "../../records/records-edit.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import { SETTINGS_FILE_NAME } from "../../settings/settings-sources.ts";
import { type SettingsFile, settingsTextOf } from "../../settings/settings-file.ts";
import { type RepoPath, repoPathSchema } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import type { CarveOutAnswered } from "../carve-out-oracle/carve-out-oracle.ts";
import { type CarveOutUnanswered, recordInputsOf } from "../carve-out-oracle/record-inputs.ts";
import { reachBeyondEntriesOf, type ReachBeyondEntries } from "../proof-comparison/written-reach.ts";
import type { HeadRecord } from "../version-one-head/head-records.ts";
import { mappedRecords, type MappedRecordsDocument, type RecordInput } from "../version-two-mapping/records-mapping.ts";
import { mappedSettings } from "../version-two-mapping/settings-mapping.ts";
import type { UpgradeRefusal } from "../version-two-mapping/upgrade-refusal.ts";
import { type ConfigImportRefusal, rewrittenConfigOf } from "../version-two-writer/config-import-rewrite.ts";

const SETTINGS_FILE = repoPathSchema.parse(SETTINGS_FILE_NAME);

export type PlannedRepoFile = { readonly file: RepoPath; readonly text: string };

export type VersionOneReading = {
  readonly selection: ConsumerSelectionFile;
  readonly heads: readonly HeadRecord[];
  readonly teamConfig: PlannedRepoFile | undefined;
  readonly versionOneProjection: RepoPath | undefined;
};

export type ProjectionFailure = { readonly kind: "projection-failed"; readonly detail: string };

export type ProjectionFilesOf = (request: {
  readonly settings: SettingsFile;
  readonly documents: readonly MappedRecordsDocument[];
}) => Promise<Result<readonly PlannedRepoFile[], ProjectionFailure>>;

export type UpgradePlan = {
  readonly inputs: readonly RecordInput[];
  readonly files: readonly PlannedRepoFile[];
  readonly replacement: PlannedRepoFile | undefined;
};

export type PlanRefusal =
  | CarveOutUnanswered
  | ProjectionFailure
  | { readonly kind: "projection-not-single"; readonly files: readonly RepoPath[] }
  | { readonly kind: "mapping-refused"; readonly refusals: readonly UpgradeRefusal[] }
  | { readonly kind: "reach-beyond-entries"; readonly records: readonly ReachBeyondEntries[] }
  | { readonly kind: "config-import-refused"; readonly refusal: ConfigImportRefusal };

export type UpgradePlanRequest = {
  readonly reading: VersionOneReading;
  readonly answered: readonly CarveOutAnswered[];
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly projectionFilesOf: ProjectionFilesOf;
};

const recordFilesOf = (request: { readonly documents: readonly MappedRecordsDocument[] }): readonly PlannedRepoFile[] =>
  request.documents.map(({ file, version, records }) => ({ file, text: recordsTextOf({ document: { version, records } }) }));

const replacementOf = (request: { readonly reading: VersionOneReading; readonly projected: readonly PlannedRepoFile[] }): Result<PlannedRepoFile | undefined, PlanRefusal> => {
  const { teamConfig, versionOneProjection } = request.reading;
  if (teamConfig === undefined || versionOneProjection === undefined) {
    return { outcome: "ok", value: undefined };
  }
  if (request.projected.length !== 1) {
    return { outcome: "failed", error: { kind: "projection-not-single", files: request.projected.map(({ file }) => file) } };
  }
  const rewritten = rewrittenConfigOf({
    file: teamConfig.file,
    text: teamConfig.text,
    versionOneProjection,
    versionTwoProjection: request.projected[0].file,
  });
  return rewritten.outcome === "ok"
    ? { outcome: "ok", value: { file: teamConfig.file, text: rewritten.value } }
    : { outcome: "failed", error: { kind: "config-import-refused", refusal: rewritten.error } };
};

export const upgradePlanOf = async (request: UpgradePlanRequest): Promise<Result<UpgradePlan, PlanRefusal>> => {
  const inputs = recordInputsOf({ heads: request.reading.heads, answered: request.answered });
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const settings = mappedSettings({ selection: request.reading.selection, catalogues: request.catalogues });
  const records = mappedRecords({ inputs: inputs.value, catalogues: request.catalogues });
  if (settings.outcome === "failed" || records.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "mapping-refused",
        refusals: [...(settings.outcome === "failed" ? settings.error : []), ...(records.outcome === "failed" ? records.error : [])],
      },
    };
  }
  const { documents } = records.value;
  const beyond = reachBeyondEntriesOf({ written: documents.flatMap(({ records: written }) => written), inputs: inputs.value, catalogues: request.catalogues });
  if (beyond.length > 0) {
    return { outcome: "failed", error: { kind: "reach-beyond-entries", records: beyond } };
  }
  const projected = await request.projectionFilesOf({ settings: settings.value.settings, documents });
  if (projected.outcome === "failed") {
    return projected;
  }
  const replacement = replacementOf({ reading: request.reading, projected: projected.value });
  if (replacement.outcome === "failed") {
    return replacement;
  }
  return {
    outcome: "ok",
    value: {
      inputs: inputs.value,
      files: [{ file: SETTINGS_FILE, text: settingsTextOf({ settings: settings.value.settings }) }, ...recordFilesOf({ documents }), ...projected.value],
      replacement: replacement.value,
    },
  };
};
