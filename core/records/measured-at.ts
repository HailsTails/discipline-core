import type { MeasuredPair } from "../mechanism-port/runner-result-schema.ts";
import type { Check } from "../symptom-catalogue/symptom-catalogue.ts";
import { type ClauseAddress, sameClauseAddress } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { RepoPath } from "../values/repo-path.ts";
import { placeCovers, type ReachedPlace } from "./record-reach.ts";

export type RunMeasurement = {
  readonly mechanism: MechanismId;
  readonly selected: readonly ClauseAddress[];
  readonly measured: readonly MeasuredPair[];
};

export type RunMeasurements = {
  readonly runs: readonly RunMeasurement[];
  readonly tracked: readonly RepoPath[];
};

export type Measurement = "measured" | "not-measured" | "not-run" | "gone";

export type EngineMeasurement = "measured-something" | "measured-nothing" | "nothing-selected" | "nothing-to-measure";

const runsOfCheck = (request: { readonly runs: readonly RunMeasurement[]; readonly check: Check }): readonly RunMeasurement[] =>
  request.runs.filter(
    (run) =>
      request.check.engines.some((engine) => engine.mechanism === run.mechanism) &&
      run.selected.some((clause) => sameClauseAddress({ left: clause, right: request.check.clause }) === "same"),
  );

const pairIsAt = (request: { readonly pair: MeasuredPair; readonly reached: ReachedPlace }): "at" | "elsewhere" =>
  sameClauseAddress({ left: request.pair.clause, right: request.reached.check.clause }) === "same" &&
  placeCovers({ place: request.reached.place, file: request.pair.file }) === "holds"
    ? "at"
    : "elsewhere";

const placeExists = (request: { readonly tracked: readonly RepoPath[]; readonly place: ReachedPlace["place"] }): "exists" | "gone" =>
  request.tracked.some((file) => placeCovers({ place: request.place, file }) === "holds") ? "exists" : "gone";

export const measurementOf = (request: { readonly measurements: RunMeasurements; readonly reached: ReachedPlace }): Measurement => {
  const { measurements, reached } = request;
  const running = runsOfCheck({ runs: measurements.runs, check: reached.check });
  if (running.length === 0) {
    return "not-run";
  }
  if (placeExists({ tracked: measurements.tracked, place: reached.place }) === "gone") {
    return "gone";
  }
  return running.some((run) => run.measured.some((pair) => pairIsAt({ pair, reached }) === "at")) ? "measured" : "not-measured";
};

export const engineMeasurementOf = (request: { readonly run: RunMeasurement; readonly inReach: readonly RepoPath[] }): EngineMeasurement => {
  if (request.run.selected.length === 0) {
    return "nothing-selected";
  }
  if (request.inReach.length === 0) {
    return "nothing-to-measure";
  }
  return request.run.measured.length === 0 ? "measured-nothing" : "measured-something";
};
