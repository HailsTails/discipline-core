import type { Finding, GovernedRun } from "../../governance/governance.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import type { Result } from "../../values/result.ts";
import { applyGovernance } from "../answering/governance.ts";
import type { ExceptionRecord } from "../version-one-records/exception-record.ts";
import { carveOutAnswersOf } from "./carve-out-answers.ts";
import type { CarveOutOracle, OracleFailure } from "./carve-out-oracle.ts";

export type EngineFindings = { readonly findings: readonly Finding[]; readonly runs: readonly GovernedRun[] };

export type EnginePassFailure = Extract<OracleFailure, { readonly kind: "version-one-run-failed" | "projection-not-current" }>;

export type EnginePass = {
  readonly findingsFor: (request: { readonly records: readonly ExceptionRecord[] }) => Promise<Result<EngineFindings, EnginePassFailure>>;
};

export const createAnsweringOracle = (request: {
  readonly enginePass: EnginePass;
  readonly catalogues: readonly RuleSetCatalogue[];
}): CarveOutOracle => ({
  answer: async ({ records }) => {
    const pass = await request.enginePass.findingsFor({ records });
    if (pass.outcome === "failed") {
      return pass;
    }
    const governed = applyGovernance({ findings: pass.value.findings, records, touched: { measured: "no", base: { state: "not-given" } }, runs: pass.value.runs });
    return carveOutAnswersOf({ records, governed, catalogues: request.catalogues });
  },
});
