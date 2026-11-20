import type { Finding } from "../../governance/governance.ts";
import { checkNamedAt, checksOf } from "../../symptom-catalogue/check-address.ts";
import type { Check, SymptomCatalogue } from "../../symptom-catalogue/symptom-catalogue.ts";
import { clauseAddressText, sameClauseAddress } from "../../values/clause-address.ts";
import type { Result } from "../../values/result.ts";
import type { GovernanceResult } from "../answering/governance.ts";
import type { ExceptionRecord } from "../version-one-records/exception-record.ts";
import type { CarveOutAnswered, FileCarveOutRecord, OracleFailure } from "./carve-out-oracle.ts";

export type CarveOutAnswersRequest = {
  readonly records: readonly ExceptionRecord[];
  readonly governed: GovernanceResult;
  readonly catalogue: Pick<SymptomCatalogue, "checks">;
};

const fileCarveOutsOf = (request: { readonly records: readonly ExceptionRecord[] }): readonly FileCarveOutRecord[] =>
  request.records.flatMap((record) => (record.kind === "file-carve-out" ? [record] : []));

const attributionFailureOf = (request: { readonly finding: Finding }): OracleFailure => ({
  kind: "finding-not-attributable",
  clause: clauseAddressText({ address: request.finding.clause }),
  file: request.finding.file,
  check: request.finding.check,
});

const checkOfFinding = (request: { readonly finding: Finding; readonly catalogue: Pick<SymptomCatalogue, "checks"> }): Result<Check, OracleFailure> => {
  const { finding, catalogue } = request;
  const named = checkNamedAt({ catalogue, clause: finding.clause, address: finding.check });
  if (named.named === "check") {
    return { outcome: "ok", value: named.check };
  }
  const [only, ...others] = checksOf({ catalogue, clause: finding.clause }).filter((check) =>
    check.engines.some((engine) => engine.mechanism === finding.mechanism),
  );
  return named.named === "unnamed" && only !== undefined && others.length === 0
    ? { outcome: "ok", value: only }
    : { outcome: "failed", error: attributionFailureOf({ finding }) };
};

const checksOfFindings = (request: { readonly findings: readonly Finding[]; readonly catalogue: Pick<SymptomCatalogue, "checks"> }): Result<readonly Check[], OracleFailure> => {
  const checks = request.findings.map((finding) => checkOfFinding({ finding, catalogue: request.catalogue }));
  const failed = checks.find((check) => check.outcome === "failed");
  return failed ?? { outcome: "ok", value: checks.flatMap((check) => (check.outcome === "ok" ? [check.value] : [])) };
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
  readonly catalogue: Pick<SymptomCatalogue, "checks">;
}): Result<CarveOutAnswered, OracleFailure> => {
  const { record, governed, catalogue } = request;
  const doublyHeld = doublyHeldFailureOf({ record, governed });
  if (doublyHeld !== undefined) {
    return { outcome: "failed", error: doublyHeld };
  }
  const credited = governed.exempted.filter((exempted) => exempted.by.includes(record)).map((exempted) => exempted.finding);
  if (credited.length > 0) {
    const checks = checksOfFindings({ findings: credited, catalogue });
    return checks.outcome === "failed" ? checks : { outcome: "ok", value: { record, answer: { credit: "findings", checks: checks.value } } };
  }
  return {
    outcome: "ok",
    value: { record, answer: { credit: governed.stale.includes(record) ? "nothing" : "suppression-only" } },
  };
};

export const carveOutAnswersOf = (request: CarveOutAnswersRequest): Result<readonly CarveOutAnswered[], OracleFailure> => {
  const answered = fileCarveOutsOf({ records: request.records }).map((record) =>
    answeredOf({ record, governed: request.governed, catalogue: request.catalogue }),
  );
  const failed = answered.find((each) => each.outcome === "failed");
  return failed ?? { outcome: "ok", value: answered.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])) };
};
