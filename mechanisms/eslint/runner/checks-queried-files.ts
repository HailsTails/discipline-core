import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { NativeException } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import { type AnsweredFile, CHECKS_PROJECTION_PATH } from "./checks-projection.ts";
import type { SelectedCheck } from "./checks-run-types.ts";
import { SETTINGS_FILE_NAME } from "./checks-nested-repositories.ts";
import { type ConfigLocation, queriedFiles } from "./create-eslint-runner.ts";
import type { RuleState } from "./eslint-config-schema.ts";
import type { QueryInstance } from "./eslint-instance.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;

export type CheckedFile = {
  readonly file: RepoPath;
  readonly states: readonly { readonly ruleId: string; readonly state: RuleState }[];
};

export type QueriedFiles = {
  readonly ignored: readonly RepoPath[];
  readonly checked: readonly CheckedFile[];
};

type ProjectionEffect = "in-effect" | "not-in-effect";

type Holding = "holds" | "does-not-hold";

const VERSION_TWO_NAMES: ConfigLocation["names"] = { settingsFile: SETTINGS_FILE_NAME, projectionFile: CHECKS_PROJECTION_PATH };

export const queriedFilesOf = (request: {
  readonly query: QueryInstance;
  readonly files: readonly RepoPath[];
  readonly ruleIds: readonly string[];
  readonly location: Omit<ConfigLocation, "names">;
}): Promise<Outcome<QueriedFiles>> => queriedFiles({ ...request, location: { ...request.location, names: VERSION_TWO_NAMES } });

const stateOf = (request: { readonly checked: CheckedFile; readonly ruleId: string }): RuleState | undefined =>
  request.checked.states.find((entry) => entry.ruleId === request.ruleId)?.state;

const answeredHolds = (request: { readonly answered: readonly AnsweredFile[]; readonly entry: SelectedCheck; readonly file: RepoPath }): Holding =>
  request.answered.some(
    (answer) => answer.file === request.file && answer.symptom === request.entry.symptom && (answer.check === undefined || `${answer.symptom}#${answer.check}` === request.entry.address),
  )
    ? "holds"
    : "does-not-hold";

const weakening = (request: { readonly checked: CheckedFile; readonly entry: SelectedCheck }): Holding => {
  const state = stateOf({ checked: request.checked, ruleId: request.entry.ruleId });
  return state?.state === "configured" && state.severity === 2 ? "does-not-hold" : "holds";
};

const offState = (request: { readonly checked: CheckedFile; readonly entry: SelectedCheck }): Holding => {
  const state = stateOf({ checked: request.checked, ruleId: request.entry.ruleId });
  return state?.state === "configured" && state.severity === 0 ? "holds" : "does-not-hold";
};

const ignoreExceptions = (request: { readonly selected: readonly SelectedCheck[]; readonly file: RepoPath }): readonly NativeException[] =>
  request.selected.map((entry): NativeException => ({ kind: "ignore", clause: entry.clause, file: request.file, check: entry.address }));

const overrideExceptions = (request: { readonly selected: readonly SelectedCheck[]; readonly answered: readonly AnsweredFile[]; readonly checked: CheckedFile }): readonly NativeException[] =>
  request.selected
    .filter((entry) => weakening({ checked: request.checked, entry }) === "holds")
    .filter((entry) => answeredHolds({ answered: request.answered, entry, file: request.checked.file }) === "does-not-hold")
    .map((entry): NativeException => ({ kind: "config-override", clause: entry.clause, file: request.checked.file, check: entry.address }));

export const queryExceptionsOf = (request: {
  readonly selected: readonly SelectedCheck[];
  readonly answered: readonly AnsweredFile[];
  readonly queried: QueriedFiles;
}): readonly NativeException[] => [
  ...request.queried.ignored.flatMap((file) => ignoreExceptions({ selected: request.selected, file })),
  ...request.queried.checked.flatMap((checked) => overrideExceptions({ selected: request.selected, answered: request.answered, checked })),
];

const enabledEverywhere = (request: { readonly selected: readonly SelectedCheck[]; readonly queried: QueriedFiles }): Holding =>
  request.queried.checked.length === 0 ||
  request.selected.every((entry) => request.queried.checked.some((checked) => stateOf({ checked, ruleId: entry.ruleId })?.state === "configured"))
    ? "holds"
    : "does-not-hold";

const answeredOff = (request: { readonly selected: readonly SelectedCheck[]; readonly answered: readonly AnsweredFile[]; readonly queried: QueriedFiles }): Holding =>
  request.queried.checked.every((checked) =>
    request.selected
      .filter((entry) => answeredHolds({ answered: request.answered, entry, file: checked.file }) === "holds")
      .every((entry) => offState({ checked, entry }) === "holds"),
  )
    ? "holds"
    : "does-not-hold";

export const projectionEffectOf = (request: {
  readonly selected: readonly SelectedCheck[];
  readonly answered: readonly AnsweredFile[];
  readonly queried: QueriedFiles;
}): ProjectionEffect => (enabledEverywhere(request) === "holds" && answeredOff(request) === "holds" ? "in-effect" : "not-in-effect");
