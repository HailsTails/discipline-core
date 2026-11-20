import type { Finding } from "../../governance/governance.ts";
import type { PlacedRecord } from "../../records/hone-record.ts";
import { runVerdictOf } from "../../report/report-sections.ts";
import type { RunReport } from "../../report/run-report.ts";
import { checkAt } from "../../symptom-catalogue/check-address.ts";
import type { Check, SymptomCatalogue } from "../../symptom-catalogue/symptom-catalogue.ts";
import { clauseAddressText } from "../../values/clause-address.ts";
import { answeredKeyOf, findingKeyOf, nativeKeyOf } from "./before-sections.ts";
import { joinedKey, type SectionKeys, uniqueKeys } from "./section-keys.ts";

const clauseTextOfFinding = (request: { readonly finding: Finding; readonly catalogue: SymptomCatalogue }): string => {
  const { finding, catalogue } = request;
  const found = finding.check === undefined ? undefined : checkAt({ catalogue, address: finding.check });
  return clauseAddressText({ address: found?.found === "check" ? found.check.clause : finding.clause });
};

const clauseTextOfCheck = (request: { readonly check: Check }): string => clauseAddressText({ address: request.check.clause });

const recordFileKeyOf = (request: { readonly placed: PlacedRecord }): string =>
  "file" in request.placed.record ? request.placed.record.file : request.placed.record.kind;

export const afterSectionsOf = (request: { readonly report: RunReport; readonly catalogue: SymptomCatalogue }): SectionKeys => {
  const { report, catalogue } = request;
  return {
    findings: report.findings.map((finding) => findingKeyOf({ finding, clauseText: clauseTextOfFinding({ finding, catalogue }) })),
    answered: report.answered.map(({ finding, by }) =>
      answeredKeyOf({
        findingKey: findingKeyOf({ finding, clauseText: clauseTextOfFinding({ finding, catalogue }) }),
        kinds: by.map((placed) => placed.record.kind),
      }),
    ),
    unrecorded: report.unrecorded.map((exception) => nativeKeyOf({ exception })),
    stale: report.stale.map((placed) => recordFileKeyOf({ placed })),
    forfeited: report.forfeited.map((placed) => recordFileKeyOf({ placed })),
    doublyHeld: [],
    invalidRecords: report.refused.map(({ place }) => joinedKey({ parts: [place.file, place.index] })),
    uncovered: uniqueKeys({ keys: report.uncovered.map((check) => clauseTextOfCheck({ check })) }),
    notAdopted: uniqueKeys({ keys: report.notAdopted.map((check) => clauseTextOfCheck({ check })) }),
    notRun: uniqueKeys({ keys: report.notRun.map((check) => clauseTextOfCheck({ check })) }),
    editions: uniqueKeys({
      keys: report.editions.map(({ check, engine, edition, latest }) => joinedKey({ parts: [clauseTextOfCheck({ check }), engine.mechanism, edition, latest] })),
    }),
    unmeasured: report.unmeasured.map((unmeasured) =>
      unmeasured.kind === "engine-not-run" ? joinedKey({ parts: [unmeasured.engine.mechanism, "not-run", unmeasured.projection] }) : unmeasured.kind,
    ),
    projectionProblems: report.projectionProblems.map((problem) =>
      joinedKey({ parts: [problem.scope, problem.engine.mechanism, problem.state, problem.scope === "slice" ? problem.slice : ""] }),
    ),
    assessment: report.assessment.map(({ concern, assessedBy }) => joinedKey({ parts: [concern, assessedBy] })),
    verdict: [runVerdictOf({ report })],
  };
};
