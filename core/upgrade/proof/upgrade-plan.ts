import type { ConsumerSelectionFile } from "../../consumer-selection/selection-file.ts";
import { recordsTextOf } from "../../records/records-edit.ts";
import type { RunLoadFailure } from "../../report/run-load-failure.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import { SETTINGS_FILE_NAME } from "../../settings/settings-sources.ts";
import { type SettingsFile, settingsTextOf } from "../../settings/settings-file.ts";
import { type RepoPath, repoPathSchema } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import type { RecordAnswered } from "../record-answers/record-answer-oracle.ts";
import { recordInputsOf, type Unanswered } from "../record-answers/record-inputs.ts";
import { reachBeyondEntriesOf, type ReachBeyondEntries } from "../proof-comparison/written-reach.ts";
import type { HeadRecord } from "../version-one-head/head-records.ts";
import { mappedRecords, type MappedRecordsDocument, type RecordInput } from "../version-two-mapping/records-mapping.ts";
import { type MarkedNotAdopted, mappedSettings } from "../version-two-mapping/settings-mapping.ts";
import type { UpgradeRefusal } from "../version-two-mapping/upgrade-refusal.ts";
import type { PlannedRepoFile } from "./planned-repo-file.ts";
import type { ReplacementRefusal } from "./projection-replacements.ts";
import type { TeamConfigRefusal } from "./team-config-finder.ts";

const SETTINGS_FILE = repoPathSchema.parse(SETTINGS_FILE_NAME);

export type VersionOneReading = {
  readonly selection: ConsumerSelectionFile;
  readonly heads: readonly HeadRecord[];
};

export type ProjectionFailure = { readonly kind: "projection-failed"; readonly failure: RunLoadFailure };

export type ProjectionFilesOf = (request: {
  readonly settings: SettingsFile;
  readonly documents: readonly MappedRecordsDocument[];
}) => Promise<Result<readonly PlannedRepoFile[], ProjectionFailure>>;

export type UpgradePlan = {
  readonly markedNotAdopted: readonly MarkedNotAdopted[];
  readonly inputs: readonly RecordInput[];
  readonly files: readonly PlannedRepoFile[];
  readonly projected: readonly PlannedRepoFile[];
};

export type PlanRefusal =
  | Unanswered
  | ProjectionFailure
  | ReplacementRefusal
  | { readonly kind: "mapping-refused"; readonly refusals: readonly UpgradeRefusal[] }
  | { readonly kind: "reach-beyond-entries"; readonly records: readonly ReachBeyondEntries[] }
  | { readonly kind: "team-config-refused"; readonly refusal: TeamConfigRefusal }
  | { readonly kind: "slice-left-in-place"; readonly files: readonly RepoPath[] };

export type UpgradePlanRequest = {
  readonly reading: VersionOneReading;
  readonly answered: readonly RecordAnswered[];
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly projectionFilesOf: ProjectionFilesOf;
};

const recordFilesOf = (request: { readonly documents: readonly MappedRecordsDocument[] }): readonly PlannedRepoFile[] =>
  request.documents.map(({ file, version, records }) => ({ file, text: recordsTextOf({ document: { version, records } }) }));

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
  return {
    outcome: "ok",
    value: {
      markedNotAdopted: settings.value.markedNotAdopted,
      inputs: inputs.value,
      files: [{ file: SETTINGS_FILE, text: settingsTextOf({ settings: settings.value.settings }) }, ...recordFilesOf({ documents }), ...projected.value],
      projected: projected.value,
    },
  };
};
