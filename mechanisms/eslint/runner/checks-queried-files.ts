import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { NativeException } from "../../../core/mechanism-port/runner-result-schema.ts";
import { gatheredOutcomes, listedOutcome } from "../../../core/values/gathered-outcomes.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { AnsweredFile } from "./checks-projection.ts";
import type { SelectedCheck } from "./checks-run-types.ts";
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

export type ProjectionEffect = "in-effect" | "not-in-effect";

type QueriedFile = { readonly file: RepoPath; readonly ignored: "ignored" } | ({ readonly ignored: "checked" } & CheckedFile);

type Holding = "holds" | "does-not-hold";

const statesOf = (request: { readonly query: QueryInstance; readonly file: RepoPath; readonly ruleIds: readonly string[] }): Promise<Outcome<CheckedFile["states"]>> =>
  Promise.all(
    request.ruleIds.map((ruleId) =>
      request.query.ruleState({ file: request.file, ruleId }).then((state): Outcome<CheckedFile["states"]> => (state.outcome === "failed" ? state : { outcome: "ok", value: [{ ruleId, state: state.value }] })),
    ),
  ).then((outcomes) => gatheredOutcomes({ outcomes }));

const queriedFileOf = (request: { readonly query: QueryInstance; readonly file: RepoPath; readonly ruleIds: readonly string[] }): Promise<Outcome<QueriedFile>> =>
  request.query.ignoredState({ file: request.file }).then(async (ignored): Promise<Outcome<QueriedFile>> => {
    if (ignored.outcome === "failed") {
      return ignored;
    }
    if (ignored.value === "ignored") {
      return { outcome: "ok", value: { file: request.file, ignored: "ignored" } };
    }
    const states = await statesOf(request);
    return states.outcome === "failed" ? states : { outcome: "ok", value: { file: request.file, ignored: "checked", states: states.value } };
  });

export const queriedFilesOf = (request: {
  readonly query: QueryInstance;
  readonly files: readonly RepoPath[];
  readonly ruleIds: readonly string[];
}): Promise<Outcome<QueriedFiles>> =>
  Promise.all(request.files.map((file) => queriedFileOf({ ...request, file }).then((outcome) => listedOutcome({ outcome })))).then((outcomes) => {
    const queried = gatheredOutcomes({ outcomes });
    return queried.outcome === "failed"
      ? queried
      : {
          outcome: "ok",
          value: {
            ignored: queried.value.flatMap((entry) => (entry.ignored === "ignored" ? [entry.file] : [])),
            checked: queried.value.flatMap((entry) => (entry.ignored === "checked" ? [{ file: entry.file, states: entry.states }] : [])),
          },
        };
  });

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
