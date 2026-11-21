import type { MeasuredPair } from "../mechanism-port/runner-result-schema.ts";
import type { Check } from "../symptom-catalogue/symptom-catalogue.ts";
import { type ClauseAddress, sameClauseAddress } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import { placeCovers, type ReachedPlace } from "./record-reach.ts";

export type RunMeasurement = {
  readonly mechanism: MechanismId;
  readonly selected: readonly ClauseAddress[];
  readonly measured: readonly MeasuredPair[];
};

export type Measurement = "measured" | "not-measured" | "not-run";

export type EngineMeasurement = "measured-something" | "measured-nothing" | "nothing-selected";

const runsOfCheck = (request: { readonly measurements: readonly RunMeasurement[]; readonly check: Check }): readonly RunMeasurement[] =>
  request.measurements.filter(
    (run) =>
      request.check.engines.some((engine) => engine.mechanism === run.mechanism) &&
      run.selected.some((clause) => sameClauseAddress({ left: clause, right: request.check.clause }) === "same"),
  );

const pairIsAt = (request: { readonly pair: MeasuredPair; readonly reached: ReachedPlace }): "at" | "elsewhere" =>
  sameClauseAddress({ left: request.pair.clause, right: request.reached.check.clause }) === "same" &&
  placeCovers({ place: request.reached.place, file: request.pair.file }) === "holds"
    ? "at"
    : "elsewhere";

export const measurementOf = (request: { readonly measurements: readonly RunMeasurement[]; readonly reached: ReachedPlace }): Measurement => {
  const running = runsOfCheck({ measurements: request.measurements, check: request.reached.check });
  if (running.length === 0) {
    return "not-run";
  }
  return running.some((run) => run.measured.some((pair) => pairIsAt({ pair, reached: request.reached }) === "at")) ? "measured" : "not-measured";
};

export const engineMeasurementOf = (request: { readonly run: RunMeasurement }): EngineMeasurement => {
  if (request.run.selected.length === 0) {
    return "nothing-selected";
  }
  return request.run.measured.length === 0 ? "measured-nothing" : "measured-something";
};
