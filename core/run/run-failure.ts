import type { Engine } from "../symptom-catalogue/symptom-catalogue.ts";
import { type RunLoadFailure, type RunLoadFailureSource, runLoadFailureOf } from "../report/run-load-failure.ts";

export type NotReadyYetSource = Extract<RunLoadFailure, { readonly kind: "not-ready-yet" }>;

export type RunFailureSource = RunLoadFailureSource | NotReadyYetSource;

export const runFailureOf = (request: { readonly engines: readonly Engine[]; readonly source: RunFailureSource }): RunLoadFailure =>
  request.source.kind === "not-ready-yet" ? request.source : runLoadFailureOf({ engines: request.engines, source: request.source });
