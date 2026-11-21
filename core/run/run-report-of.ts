import type { Selection } from "../settings/selection.ts";
import type { Finding } from "../governance/governance.ts";
import { type Answering, answerFindings, type RaisedFinding } from "../records/answering.ts";
import type { RecordsReading } from "../records/hone-record.ts";
import type { PartyReport } from "../records/record-reach.ts";
import { carriedListingOf } from "../records/records-reading.ts";
import { recordsUnmeasuredOf } from "../records/records-unmeasured.ts";
import { findingSiteOf } from "../report/check-site.ts";
import type { ForfeitureElsewhere, RunReport } from "../report/run-report.ts";
import type { SettingsNote } from "../settings/read-settings.ts";
import { checkAddressOf } from "../symptom-catalogue/check-address.ts";
import { checkOfFinding } from "../symptom-catalogue/finding-check.ts";
import type { Symptom, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { TouchedSet } from "../touched-set/touched-set.ts";
import type { Assessment } from "../values/assessment.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { EngineRun } from "./engine-run.ts";
import { engineProblemsOf, engineUnmeasuredOf, runMeasurementsOf } from "./engine-states.ts";
import { checksOfClauses, editionsOf } from "./selection-checks.ts";

export type RunReportRequest = {
  readonly catalogue: SymptomCatalogue;
  readonly selection: Selection;
  readonly excluded: readonly RepoPath[];
  readonly notes: readonly SettingsNote[];
  readonly records: RecordsReading;
  readonly touched: TouchedSet;
  readonly runs: readonly EngineRun[];
  readonly tracked: readonly RepoPath[];
  readonly assessment: Assessment;
};

const namingItsCheck = (request: { readonly catalogue: SymptomCatalogue; readonly finding: Finding }): Finding => {
  const resolved = checkOfFinding(request);
  return resolved.resolved === "check" ? { ...request.finding, check: checkAddressOf({ check: resolved.check }) } : request.finding;
};

const findingsOf = (request: { readonly catalogue: SymptomCatalogue; readonly runs: readonly EngineRun[] }): readonly Finding[] =>
  request.runs.flatMap((run) => run.hits.map((hit) => namingItsCheck({ catalogue: request.catalogue, finding: { ...hit, mechanism: run.mechanism } })));

const partyOf = (request: { readonly finding: Finding }): PartyReport =>
  request.finding.importSpecifier === undefined ? { reported: "not-reported" } : { reported: "specifier", specifier: request.finding.importSpecifier };

const answeringOf = (request: RunReportRequest): Answering => {
  const raised: readonly RaisedFinding[] = findingsOf(request).map((finding) => ({ finding, party: partyOf({ finding }) }));
  return answerFindings({ catalogue: request.catalogue, records: request.records.records, findings: raised, touched: request.touched, runs: request.runs, measurements: runMeasurementsOf({ runs: request.runs, selected: request.selection.selected, tracked: request.tracked }) });
};

const symptomsOf = (request: { readonly catalogue: SymptomCatalogue; readonly findings: readonly Finding[] }): readonly Symptom[] => {
  const named = request.findings.flatMap((finding) => {
    const site = findingSiteOf({ catalogue: request.catalogue, finding });
    return site.sited === "check" ? [site.check.symptom] : [];
  });
  return named.filter((symptom, index) => named.findIndex((earlier) => earlier.name === symptom.name) === index);
};

const assessmentOf = (request: RunReportRequest): readonly ForfeitureElsewhere[] =>
  request.assessment.forfeiture === "elsewhere"
    ? [{ concern: "forfeiture", assessedBy: "elsewhere", debts: request.records.records.filter((placed) => placed.record.kind === "debt").length }]
    : [];

export const runReportOf = (request: RunReportRequest): RunReport => {
  const answering = answeringOf(request);
  const { catalogue, selection, records, runs } = request;
  return {
    excluded: request.excluded,
    notAdopted: checksOfClauses({ catalogue, clauses: selection.notAdopted }),
    notRun: checksOfClauses({ catalogue, clauses: selection.notRun }),
    editions: editionsOf({ catalogue, readings: selection.editions }),
    findings: answering.findings,
    answered: answering.answered,
    uncovered: checksOfClauses({ catalogue, clauses: selection.uncovered }),
    stale: answering.stale,
    forfeited: answering.forfeited,
    unrecorded: answering.unrecorded,
    misnamed: runs.flatMap((run) => run.misnamedRuleIds),
    paid: answering.paid,
    refused: records.refused,
    unmeasured: [...recordsUnmeasuredOf({ records: records.records, base: records.base, touched: request.touched }), ...engineUnmeasuredOf({ catalogue, runs, selected: selection.selected, tracked: request.tracked })],
    projectionProblems: engineProblemsOf({ catalogue, runs }),
    assessment: assessmentOf(request),
    notes: request.notes,
    recordNotes: records.notes,
    carried: carriedListingOf({ records: records.records }),
    symptoms: symptomsOf({ catalogue, findings: answering.findings }),
  };
};
