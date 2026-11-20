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
import type { ExceptionRecord } from "../version-one-records/exception-record.ts";
import { mappedRecords, type MappedRecordsDocument, type RecordInput } from "../version-two-mapping/records-mapping.ts";
import { mappedSettings } from "../version-two-mapping/settings-mapping.ts";
import type { UpgradeRefusal } from "../version-two-mapping/upgrade-refusal.ts";
import { type ConfigImportRefusal, rewrittenConfigOf } from "../version-two-writer/config-import-rewrite.ts";

const SETTINGS_FILE = repoPathSchema.parse(SETTINGS_FILE_NAME);

export type PlannedRepoFile = { readonly file: RepoPath; readonly text: string };

export type VersionOneReading = {
  readonly selection: ConsumerSelectionFile;
  readonly records: readonly ExceptionRecord[];
  readonly heads: readonly HeadRecord[];
  readonly teamConfig: PlannedRepoFile | undefined;
  readonly versionOneProjection: RepoPath;
};

export type ProjectionTextOf = (request: { readonly settings: SettingsFile; readonly documents: readonly MappedRecordsDocument[] }) => string | undefined;

export type UpgradePlan = {
  readonly inputs: readonly RecordInput[];
  readonly files: readonly PlannedRepoFile[];
  readonly replacement: PlannedRepoFile | undefined;
};

export type PlanRefusal =
  | CarveOutUnanswered
  | { readonly kind: "mapping-refused"; readonly refusals: readonly UpgradeRefusal[] }
  | { readonly kind: "reach-beyond-entries"; readonly records: readonly ReachBeyondEntries[] }
  | { readonly kind: "config-import-refused"; readonly refusal: ConfigImportRefusal };

export type UpgradePlanRequest = {
  readonly reading: VersionOneReading;
  readonly answered: readonly CarveOutAnswered[];
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly versionTwoProjection: RepoPath;
  readonly projectionTextOf: ProjectionTextOf;
};

const recordFilesOf = (request: { readonly documents: readonly MappedRecordsDocument[] }): readonly PlannedRepoFile[] =>
  request.documents.map(({ file, version, records }) => ({ file, text: recordsTextOf({ document: { version, records } }) }));

const projectionFilesOf = (request: {
  readonly text: string | undefined;
  readonly file: RepoPath;
}): readonly PlannedRepoFile[] => (request.text === undefined ? [] : [{ file: request.file, text: request.text }]);

const replacementOf = (request: UpgradePlanRequest): Result<PlannedRepoFile | undefined, PlanRefusal> => {
  const { teamConfig, versionOneProjection } = request.reading;
  if (teamConfig === undefined) {
    return { outcome: "ok", value: undefined };
  }
  const rewritten = rewrittenConfigOf({
    file: teamConfig.file,
    text: teamConfig.text,
    versionOneProjection,
    versionTwoProjection: request.versionTwoProjection,
  });
  return rewritten.outcome === "ok"
    ? { outcome: "ok", value: { file: teamConfig.file, text: rewritten.value } }
    : { outcome: "failed", error: { kind: "config-import-refused", refusal: rewritten.error } };
};

export const upgradePlanOf = (request: UpgradePlanRequest): Result<UpgradePlan, PlanRefusal> => {
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
  const replacement = replacementOf(request);
  if (replacement.outcome === "failed") {
    return replacement;
  }
  return {
    outcome: "ok",
    value: {
      inputs: inputs.value,
      files: [
        { file: SETTINGS_FILE, text: settingsTextOf({ settings: settings.value.settings }) },
        ...recordFilesOf({ documents }),
        ...projectionFilesOf({ text: request.projectionTextOf({ settings: settings.value.settings, documents }), file: request.versionTwoProjection }),
      ],
      replacement: replacement.value,
    },
  };
};
