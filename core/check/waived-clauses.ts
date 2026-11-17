import type { ClauseBinding } from "../consumer-selection/consumer-selection.ts";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { LoadedRunner } from "../mechanism-port/runner-module-schema.ts";
import type { WaivedClausesAssessment } from "../values/assessment.ts";
import { type ClauseAddress, clauseAddressText } from "../values/clause-address.ts";
import type { NotRunClause, PartialAssessment } from "../verdict/check-report.ts";

export type WaiverRequest = {
  readonly waivedClauses: WaivedClausesAssessment;
  readonly records: readonly ExceptionRecord[];
};

const clauseKey = (request: { readonly address: ClauseAddress }): string => clauseAddressText(request);

const waivedClauseKeys = (request: { readonly records: readonly ExceptionRecord[] }): ReadonlySet<string> =>
  new Set(
    request.records.flatMap((record) =>
      record.kind === "clause-wide-carve-out" ? [clauseKey({ address: record.clause })] : [],
    ),
  );

const waivingOf = (request: { readonly binding: ClauseBinding; readonly waived: ReadonlySet<string> }): "waived" | "in-force" =>
  request.waived.has(clauseKey({ address: request.binding.clause.address })) ? "waived" : "in-force";

const bindingsInForce = (request: WaiverRequest & { readonly bindings: readonly ClauseBinding[] }): readonly ClauseBinding[] => {
  if (request.waivedClauses === "run") {
    return request.bindings;
  }
  const waived = waivedClauseKeys(request);
  return request.bindings.filter((binding) => waivingOf({ binding, waived }) === "in-force");
};

export const bindingsToLoad = (
  request: WaiverRequest & { readonly bindings: readonly ClauseBinding[] },
): readonly ClauseBinding[] => {
  const mechanismsWithWork = new Set(bindingsInForce(request).map((binding) => binding.mechanism));
  return request.bindings.filter((binding) => mechanismsWithWork.has(binding.mechanism));
};

export const bindingsToRun = (
  request: WaiverRequest & { readonly bindings: readonly ClauseBinding[]; readonly runner: LoadedRunner },
): readonly ClauseBinding[] => {
  switch (request.runner.exceptionPath) {
    case "standalone":
      return bindingsInForce(request);
    case "embedded":
      return request.bindings;
  }
};

const ranIn = (request: {
  readonly binding: ClauseBinding;
  readonly ran: readonly ClauseBinding[];
}): "ran" | "not-run" =>
  request.ran.some(
    (ran) =>
      ran.mechanism === request.binding.mechanism &&
      clauseKey({ address: ran.clause.address }) === clauseKey({ address: request.binding.clause.address }),
  )
    ? "ran"
    : "not-run";

export const notRunClauses = (request: {
  readonly bindings: readonly ClauseBinding[];
  readonly ran: readonly ClauseBinding[];
}): readonly NotRunClause[] =>
  request.bindings
    .filter((binding) => ranIn({ binding, ran: request.ran }) === "not-run")
    .map((binding) => ({ clause: binding.clause.address, mechanism: binding.mechanism }));

const recordsOnClauses = (request: {
  readonly records: readonly ExceptionRecord[];
  readonly notRun: readonly NotRunClause[];
}): number => {
  const keys = new Set(request.notRun.map((entry) => `${clauseKey({ address: entry.clause })} ${entry.mechanism}`));
  return request.records.filter((record) => keys.has(`${clauseKey({ address: record.clause })} ${record.mechanism}`)).length;
};

export const waivedClausesAssessmentOf = (
  request: WaiverRequest & { readonly notRun: readonly NotRunClause[] },
): readonly PartialAssessment[] =>
  request.waivedClauses === "not-run"
    ? [
        {
          concern: "waivedClauses",
          assessedBy: "not-run",
          clausesNotRun: request.notRun,
          recordsNotJudgedStale: recordsOnClauses(request),
        },
      ]
    : [];

