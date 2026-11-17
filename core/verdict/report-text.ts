import { type ExceptionRecord, type InvalidRecord, recordImportOf } from "../exception-records/exception-records.ts";
import type { AttributedNativeException, ExemptedFinding, Finding } from "../governance/governance.ts";
import { clauseAddressText } from "../values/clause-address.ts";
import { TOOL_IDENTITY } from "../values/tool-identity.ts";
import type { ReportOutput } from "../values/report-output.ts";
import { ASSESSMENT_FILE_NAME, assessmentSectionHeading } from "../values/assessment-file.ts";
import type { AssessmentFileNote, CheckReport, ClauseReading, PartialAssessment, ProjectionProblem, ReadFirstEntry, Unmeasured } from "./check-report.ts";
import { SECTION_NAMES, type SectionName } from "./section-roles.ts";
import { printedSectionLines, type ReportSection } from "./section-selection.ts";
import { verdictOf } from "./verdict.ts";

const escapedLineBreaks = (request: { readonly text: string }): string =>
  request.text.replaceAll("\n", "\\n").replaceAll("\r", "\\r");

const findingLine = (request: { readonly finding: Finding }): string =>
  `${clauseAddressText({ address: request.finding.clause })} ${request.finding.mechanism} ${request.finding.file}:${request.finding.anchor.line}:${request.finding.anchor.column} ${escapedLineBreaks({ text: request.finding.snippet })}`;

const importNote = (request: { readonly record: ExceptionRecord }): string => {
  const recordImport = recordImportOf(request);
  return recordImport.imported === "yes" ? ` imported from ${recordImport.source}` : "";
};

const exemptedLine = (request: { readonly exempted: ExemptedFinding }): string =>
  `${findingLine({ finding: request.exempted.finding })}${request.exempted.by
    .map((record) => ` exempted by ${record.kind}${importNote({ record })}`)
    .join("")}`;

const recordFile = (request: { readonly record: ExceptionRecord }): string => {
  switch (request.record.kind) {
    case "authorised-location":
    case "file-carve-out":
      return request.record.file;
    case "clause-wide-carve-out":
      return "*";
  }
};

const recordLine = (request: { readonly record: ExceptionRecord }): string =>
  `${clauseAddressText({ address: request.record.clause })} ${request.record.mechanism} ${request.record.kind} ${recordFile(request)}`;

const unrecordedDetail = (request: { readonly exception: AttributedNativeException }): string => {
  switch (request.exception.kind) {
    case "ignore":
    case "config-override":
      return request.exception.file;
    case "suppression-entry":
      return `${request.exception.file} ${request.exception.location}`;
    case "inline-disable":
    case "inline-rule-config":
      return `${request.exception.file}:${request.exception.line} ${escapedLineBreaks({ text: request.exception.text })}`;
    case "command-line-option":
      return `${request.exception.location} ${escapedLineBreaks({ text: request.exception.script })} ${escapedLineBreaks({ text: request.exception.option })}`;
  }
};

const unrecordedLine = (request: { readonly exception: AttributedNativeException }): string =>
  `${clauseAddressText({ address: request.exception.clause })} ${request.exception.mechanism} ${request.exception.kind} ${unrecordedDetail(request)}`;

const invalidDetail = (request: { readonly problem: InvalidRecord["problem"] }): string => {
  switch (request.problem.kind) {
    case "clause-unparseable":
    case "why-chain-refused":
    case "evidence-refused":
    case "import-unverified":
      return escapedLineBreaks({ text: request.problem.detail });
    case "clause-not-selected":
    case "clause-not-adopted":
    case "clause-not-run":
    case "non-exemptible-clause":
      return clauseAddressText({ address: request.problem.clause });
    case "file-not-repo-path":
      return escapedLineBreaks({ text: request.problem.file });
    case "duplicate":
      return `of ${request.problem.ofIndex}`;
  }
};

const NESTED_CONFIGURATION_ISSUE = `${TOOL_IDENTITY.repository}/issues/72`;

const nestedConfigurationNote = (request: {
  readonly unmeasured: Extract<Unmeasured, { readonly kind: "mechanism-not-run" }>;
}): string =>
  request.unmeasured.projection === "missing" || request.unmeasured.nestedConfigurations.length === 0
    ? ""
    : `; not managed from this repository, each holding its own disciplines.json: ${request.unmeasured.nestedConfigurations.join(", ")}; nested Hone configurations are not supported yet, see ${NESTED_CONFIGURATION_ISSUE}`;

const unmeasuredLine = (request: { readonly unmeasured: Unmeasured }): string => {
  switch (request.unmeasured.kind) {
    case "forfeiture-unmeasured":
    case "import-unmeasured":
    case "legacy-chain-unmeasured":
      return request.unmeasured.kind;
    case "mechanism-not-run":
      return `${request.unmeasured.kind} ${request.unmeasured.mechanism} ${request.unmeasured.projection}${nestedConfigurationNote({ unmeasured: request.unmeasured })}`;
  }
};

const counted = (request: { readonly count: number; readonly noun: string }): string =>
  request.count === 1 ? `1 ${request.noun}` : `${request.count} ${request.noun}s`;

const assessmentLine = (request: { readonly partial: PartialAssessment }): string => {
  switch (request.partial.concern) {
    case "forfeiture":
      return `forfeiture ${request.partial.assessedBy}: ${counted({ count: request.partial.fileCarveOuts, noun: "file carve-out" })} not checked for decay in this run`;
  }
};

const projectionProblemLine = (request: { readonly problem: ProjectionProblem }): string =>
  request.problem.scope === "slice"
    ? `${request.problem.mechanism} ${request.problem.state} ${request.problem.slice}`
    : `${request.problem.mechanism} ${request.problem.state}`;

const sectionRead = (request: { readonly reading: ClauseReading }): string =>
  `read the ${JSON.stringify(assessmentSectionHeading(request.reading))} section of ${ASSESSMENT_FILE_NAME}`;

const pointedReading = (request: { readonly reading: ClauseReading }): string => {
  const page = request.reading.rulePage.path;
  const sectioned = request.reading.assessmentSection === "present";
  if (request.reading.rulePage.presence === "absent") {
    const missingPage = `its rule set has no rule page at ${page}`;
    return sectioned ? `${sectionRead(request)}; ${missingPage}` : missingPage;
  }
  return sectioned ? `${sectionRead(request)}, then ${page}#spirit` : `read ${page}#spirit`;
};

const assessmentContext = (request: { readonly reading: ClauseReading }): string =>
  request.reading.assessmentSection === "not-assessed" ? `; ${ASSESSMENT_FILE_NAME} does not assess this clause` : "";

const SPIRIT_LEAD = "Start from each rule's Spirit below. ";

type SpiritBelow = "named" | "none";

const spiritBelowIn = (request: { readonly entries: readonly ReadFirstEntry[] }): SpiritBelow =>
  request.entries.some((entry) => entry.kind === "clause" && entry.rulePage.presence === "present") ? "named" : "none";

const assessmentFileState = (request: { readonly note: AssessmentFileNote }): string => {
  switch (request.note.state) {
    case "not-written":
      return `${ASSESSMENT_FILE_NAME}, where this repository records its own causes, forward goal and steps for a clause, is not written yet; ${request.note.guide}#5a-write-the-assessment says how to write it.`;
    case "unreadable":
      return `${ASSESSMENT_FILE_NAME} could not be read.`;
  }
};

const assessmentFileLine = (request: { readonly note: AssessmentFileNote; readonly spiritBelow: SpiritBelow }): string =>
  `${request.spiritBelow === "named" ? SPIRIT_LEAD : ""}${assessmentFileState(request)}`;

const readFirstLine = (request: { readonly entry: ReadFirstEntry; readonly spiritBelow: SpiritBelow }): string => {
  switch (request.entry.kind) {
    case "assessment-file":
      return assessmentFileLine({ note: request.entry, spiritBelow: request.spiritBelow });
    case "clause":
      return `${clauseAddressText({ address: request.entry.clause })}: ${pointedReading({ reading: request.entry })}${assessmentContext({ reading: request.entry })}`;
  }
};

type ReportLines = (request: { readonly report: CheckReport }) => readonly string[];

const SECTION_LINES: Readonly<Record<SectionName, ReportLines>> = {
  excluded: (request) => request.report.excluded,
  notAdopted: (request) => request.report.notAdopted.map((address) => clauseAddressText({ address })),
  notRun: (request) =>
    request.report.notRun.map((address) => `${clauseAddressText({ address })} adopted, mechanism not run: enforced by review`),
  findings: (request) => request.report.findings.map((finding) => findingLine({ finding })),
  exempted: (request) => request.report.exempted.map((exempted) => exemptedLine({ exempted })),
  uncovered: (request) => request.report.uncovered.map((address) => clauseAddressText({ address })),
  stale: (request) => request.report.stale.map((record) => recordLine({ record })),
  forfeited: (request) => request.report.forfeited.map((record) => recordLine({ record })),
  unrecorded: (request) => request.report.unrecorded.map((exception) => unrecordedLine({ exception })),
  doublyHeld: (request) =>
    request.report.doublyHeld.map(
      (held) => `${clauseAddressText({ address: held.clause })} ${held.mechanism} doubly-held ${held.file}`,
    ),
  invalidRecords: (request) =>
    request.report.invalidRecords.map(
      (invalid) => `exceptions[${invalid.index}] ${invalid.problem.kind} ${invalidDetail(invalid)}`,
    ),
  unmeasured: (request) => request.report.unmeasured.map((unmeasured) => unmeasuredLine({ unmeasured })),
  projectionProblems: (request) =>
    request.report.projectionProblems.map((problem) => projectionProblemLine({ problem })),
  assessment: (request) => request.report.assessment.map((partial) => assessmentLine({ partial })),
  readFirst: (request) => {
    const spiritBelow = spiritBelowIn({ entries: request.report.readFirst });
    return request.report.readFirst.map((entry) => readFirstLine({ entry, spiritBelow }));
  },
};

const reportSections = (request: { readonly report: CheckReport }): readonly ReportSection[] =>
  SECTION_NAMES.map((name) => ({ name, lines: SECTION_LINES[name](request) }));

const verdictLine = (request: { readonly report: CheckReport }): string =>
  request.report.assessment.length === 0
    ? `verdict: ${verdictOf(request)}`
    : `verdict: ${verdictOf(request)} (partial assessment)`;

export const renderReportText = (request: { readonly report: CheckReport; readonly output: ReportOutput }): string => {
  const sectionLines = reportSections(request)
    .filter((section) => section.lines.length > 0)
    .flatMap((section) => printedSectionLines({ output: request.output, section }));
  return `${[...sectionLines, verdictLine(request)].join("\n")}\n`;
};
