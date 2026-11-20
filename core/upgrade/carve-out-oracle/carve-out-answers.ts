import type { Finding } from "../../governance/governance.ts";
import { sitesOfFinding } from "../../records/debt-sites.ts";
import { catalogueOf, type RuleSetCatalogue } from "../../settings/check-choices.ts";
import type { Check } from "../../symptom-catalogue/symptom-catalogue.ts";
import { clauseAddressText, sameClauseAddress } from "../../values/clause-address.ts";
import type { Result } from "../../values/result.ts";
import type { GovernanceResult } from "../answering/governance.ts";
import type { ExceptionRecord } from "../version-one-records/exception-record.ts";
import type { CarveOutAnswered, FileCarveOutRecord, OracleFailure } from "./carve-out-oracle.ts";

export type CarveOutAnswersRequest = {
  readonly records: readonly ExceptionRecord[];
  readonly governed: GovernanceResult;
  readonly catalogues: readonly RuleSetCatalogue[];
};

const fileCarveOutsOf = (request: { readonly records: readonly ExceptionRecord[] }): readonly FileCarveOutRecord[] =>
  request.records.flatMap((record) => (record.kind === "file-carve-out" ? [record] : []));

const attributionFailureOf = (request: { readonly finding: Finding }): OracleFailure => ({
  kind: "finding-not-attributable",
  clause: clauseAddressText({ address: request.finding.clause }),
  file: request.finding.file,
  check: request.finding.check,
});

const checksOfFinding = (request: { readonly finding: Finding; readonly catalogues: readonly RuleSetCatalogue[] }): readonly Check[] => {
  const { finding, catalogues } = request;
  const catalogue = catalogueOf({ catalogues, ruleSet: finding.clause.ruleSet });
  return catalogue === undefined
    ? []
    : sitesOfFinding({ catalogue, finding }).flatMap((site) => (site.check.found === "check" ? [site.check.check] : []));
};

const checksOfFindings = (request: { readonly findings: readonly Finding[]; readonly catalogues: readonly RuleSetCatalogue[] }): Result<readonly Check[], OracleFailure> => {
  const sited = request.findings.map((finding) => ({ finding, checks: checksOfFinding({ finding, catalogues: request.catalogues }) }));
  const unsited = sited.find(({ checks }) => checks.length === 0);
  return unsited === undefined
    ? { outcome: "ok", value: sited.flatMap(({ checks }) => checks) }
    : { outcome: "failed", error: attributionFailureOf({ finding: unsited.finding }) };
};

const doublyHeldFailureOf = (request: { readonly record: FileCarveOutRecord; readonly governed: GovernanceResult }): OracleFailure | undefined =>
  request.governed.doublyHeld.some(
    (pair) => pair.file === request.record.file && sameClauseAddress({ left: pair.clause, right: request.record.clause }) === "same",
  )
    ? { kind: "record-doubly-held", clause: clauseAddressText({ address: request.record.clause }), file: request.record.file }
    : undefined;

const answeredOf = (request: {
  readonly record: FileCarveOutRecord;
  readonly governed: GovernanceResult;
  readonly catalogues: readonly RuleSetCatalogue[];
}): Result<CarveOutAnswered, OracleFailure> => {
  const { record, governed, catalogues } = request;
  const doublyHeld = doublyHeldFailureOf({ record, governed });
  if (doublyHeld !== undefined) {
    return { outcome: "failed", error: doublyHeld };
  }
  const credited = governed.exempted.filter((exempted) => exempted.by.includes(record)).map((exempted) => exempted.finding);
  if (credited.length > 0) {
    const checks = checksOfFindings({ findings: credited, catalogues });
    return checks.outcome === "failed" ? checks : { outcome: "ok", value: { record, answer: { credit: "findings", checks: checks.value } } };
  }
  return {
    outcome: "ok",
    value: { record, answer: { credit: governed.stale.includes(record) ? "nothing" : "suppression-only" } },
  };
};

export const carveOutAnswersOf = (request: CarveOutAnswersRequest): Result<readonly CarveOutAnswered[], OracleFailure> => {
  const answered = fileCarveOutsOf({ records: request.records }).map((record) =>
    answeredOf({ record, governed: request.governed, catalogues: request.catalogues }),
  );
  const failed = answered.find((each) => each.outcome === "failed");
  return failed ?? { outcome: "ok", value: answered.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])) };
};
