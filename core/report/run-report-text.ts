import type { SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { ReportOutput } from "../values/report-output.ts";
import { forfeitedLine, type PruneCommand, paidLine, staleLine } from "./debt-lines.ts";
import { answeredLine, checkLine, editionLine, findingLine, notRunLine, unrecordedLines } from "./finding-lines.ts";
import { misnamedLine } from "./misnamed-lines.ts";
import { carriedLine, recordNoteLine, refusedLines } from "./record-lines.ts";
import { RUN_SECTION_NAMES, type RunSectionName, runSectionRoleOf, runVerdictOf } from "./report-sections.ts";
import type { RunReport } from "./run-report.ts";
import { assessmentLine, projectionProblemLine, settingsNoteLine, unmeasuredLine } from "./run-state-lines.ts";
import { symptomLine } from "./symptom-lines.ts";

export type RunReportRequest = PruneCommand & {
  readonly report: RunReport;
  readonly catalogue: SymptomCatalogue;
  readonly symptomPage: string;
  readonly projectCommand: string;
  readonly output: ReportOutput;
};

type SectionLines = (request: RunReportRequest) => readonly string[];

const SECTION_LINES: Readonly<Record<RunSectionName, SectionLines>> = {
  excluded: (request) => request.report.excluded,
  notAdopted: (request) => request.report.notAdopted.map((check) => checkLine({ check })),
  notRun: (request) => request.report.notRun.map((check) => notRunLine({ check })),
  editions: (request) => request.report.editions.map((reading) => editionLine({ reading })),
  findings: (request) => request.report.findings.map((finding) => findingLine({ catalogue: request.catalogue, finding })),
  answered: (request) => request.report.answered.map((answered) => answeredLine({ catalogue: request.catalogue, answered })),
  uncovered: (request) => request.report.uncovered.map((check) => checkLine({ check })),
  stale: (request) => request.report.stale.map((placed) => staleLine({ placed, pruneCommand: request.pruneCommand })),
  forfeited: (request) => request.report.forfeited.map((placed) => forfeitedLine({ placed, pruneCommand: request.pruneCommand })),
  unrecorded: (request) => request.report.unrecorded.flatMap((exception) => unrecordedLines({ catalogue: request.catalogue, exception })),
  misnamed: (request) => request.report.misnamed.map((misnamed) => misnamedLine({ misnamed })),
  paid: (request) => request.report.paid.map((paid) => paidLine({ paid, pruneCommand: request.pruneCommand })),
  refused: (request) => request.report.refused.flatMap((refused) => refusedLines({ refused })),
  unmeasured: (request) =>
    request.report.unmeasured.map((unmeasured) => unmeasuredLine({ projectCommand: request.projectCommand, unmeasured, problems: request.report.projectionProblems })),
  projectionProblems: (request) => request.report.projectionProblems.map((problem) => projectionProblemLine({ projectCommand: request.projectCommand, problem })),
  assessment: (request) => request.report.assessment.map((partial) => assessmentLine({ partial })),
  notes: (request) => request.report.notes.map((note) => settingsNoteLine({ note })),
  recordNotes: (request) => request.report.recordNotes.map((recordNote) => recordNoteLine({ recordNote })),
  carried: (request) => request.report.carried.map((listing) => carriedLine({ listing })),
  symptoms: (request) => request.report.symptoms.map((symptom) => symptomLine({ catalogue: request.catalogue, symptom, page: request.symptomPage })),
};

type PrintedSection = { readonly name: RunSectionName; readonly lines: readonly string[] };

const headingOf = (request: { readonly section: PrintedSection }): string => `${request.section.name} (${request.section.lines.length})`;

const countLine = (request: { readonly section: PrintedSection }): string => {
  const role = runSectionRoleOf({ section: request.section.name });
  return role === "failing" ? headingOf(request) : `${headingOf(request)} ${role}`;
};

const printedLines = (request: { readonly output: ReportOutput; readonly section: PrintedSection }): readonly string[] => {
  const headed = [headingOf(request), ...request.section.lines];
  switch (request.output) {
    case "full":
      return headed;
    case "failures-only":
      return runSectionRoleOf({ section: request.section.name }) === "informational" ? [] : headed;
    case "counts":
      return [countLine(request)];
    case "verdict-only":
      return [];
  }
};

const verdictLine = (request: { readonly report: RunReport }): string =>
  request.report.assessment.length === 0 ? `verdict: ${runVerdictOf(request)}` : `verdict: ${runVerdictOf(request)} (partial assessment)`;

export const renderRunReportText = (request: RunReportRequest): string => {
  const sectionLines = RUN_SECTION_NAMES.map((name) => ({ name, lines: SECTION_LINES[name](request) }))
    .filter((section) => section.lines.length > 0)
    .flatMap((section) => printedLines({ output: request.output, section }));
  return `${[...sectionLines, verdictLine(request)].join("\n")}\n`;
};
