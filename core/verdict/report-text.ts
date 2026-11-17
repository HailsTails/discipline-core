import { type ExceptionRecord, type InvalidRecord, recordImportOf } from "../exception-records/exception-records.ts";
import type { AttributedNativeException, ExemptedFinding, Finding } from "../governance/governance.ts";
import { clauseAddressText } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { RepoPath } from "../values/repo-path.ts";
import { TOOL_IDENTITY } from "../values/tool-identity.ts";
import type { ReportOutput } from "../values/report-output.ts";
import { ASSESSMENT_FILE_NAME, assessmentSectionHeading } from "../values/assessment-file.ts";
import type { ChangeSetBase } from "../values/base-revision-availability.ts";
import type {
  AssessmentFileNote,
  CheckReport,
  ClauseReading,
  PartialAssessment,
  ProjectionProblem,
  ReadFirstEntry,
  Unmeasured,
} from "./check-report.ts";
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

type RecordsUnmeasured = Extract<Unmeasured, { readonly kind: "import-unmeasured" | "legacy-chain-unmeasured" }>;

type MechanismNotRun = Extract<Unmeasured, { readonly kind: "mechanism-not-run" }>;

const PASS_A_BASE = "pass --base-revision with the branch's base, such as origin/main";

const NO_SUCH_COMMIT = "this clone holds no commit by that name";

const FIX_WHAT_GIT_REPORTS = "fix what git reports (Hone needs git 2.24 or later), then run the check again";

const RECORDS_CHECKED_AGAINST_A_BASE: Readonly<Record<RecordsUnmeasured["kind"], string>> = {
  "import-unmeasured": "imported records",
  "legacy-chain-unmeasured": "legacy-chain records",
};

const NO_MERGE_BASE_IN: Readonly<Record<"shallow" | "complete", string>> = {
  shallow:
    "this shallow clone holds no commit that revision and HEAD share; deepen it with git fetch --deepen=<commits> until they share one, or fetch the whole history with git fetch --unshallow (with actions/checkout, set fetch-depth: 0)",
  complete: "HEAD shares no history with that revision; pass --base-revision with the revision this branch started from",
};

const quoted = (request: { readonly text: string }): string => JSON.stringify(request.text);

const forfeitureLine = (request: { readonly base: ChangeSetBase }): string => {
  const { base } = request;
  switch (base.state) {
    case "not-given":
      return `forfeiture-unmeasured no-base-revision: no --base-revision was given, so file carve-outs cannot be checked for decay; ${PASS_A_BASE}`;
    case "not-found":
      return `forfeiture-unmeasured base-not-found ${quoted({ text: base.revision })}: ${NO_SUCH_COMMIT}; fetch it, or pass --base-revision with a revision this clone holds`;
    case "no-merge-base":
      return `forfeiture-unmeasured no-merge-base ${quoted({ text: base.revision })}: ${NO_MERGE_BASE_IN[base.clone]}`;
    case "git-failed":
      return `forfeiture-unmeasured base-git-failed ${quoted({ text: base.revision })}: git could not list the files changed since that revision and said ${quoted({ text: base.gitMessage })}; ${FIX_WHAT_GIT_REPORTS}`;
  }
};

const recordsLine = (request: { readonly unmeasured: RecordsUnmeasured }): string => {
  const { kind, base } = request.unmeasured;
  switch (base.state) {
    case "not-given":
      return `${kind} no-base-revision: no --base-revision was given, so ${RECORDS_CHECKED_AGAINST_A_BASE[kind]} cannot be checked against it; ${PASS_A_BASE}`;
    case "not-found":
      return `${kind} base-not-found ${quoted({ text: base.revision })}: ${NO_SUCH_COMMIT}; fetch that one commit (a fetch of depth 1 is enough), or pass --base-revision with a revision this clone holds`;
    case "git-failed":
      return `${kind} base-git-failed ${quoted({ text: base.revision })}: git could not read the exception records at that revision and said ${quoted({ text: base.gitMessage })}; ${FIX_WHAT_GIT_REPORTS}`;
  }
};

const NESTED_CONFIGURATION_ISSUE = `${TOOL_IDENTITY.repository}/issues/72`;

type ProjectionRequest = { readonly projectCommand: string };

const projectionFileOf = (request: { readonly mechanism: MechanismId }): string => `disciplines.${request.mechanism}.mjs`;

const refreshStep = (request: ProjectionRequest & { readonly mechanism: MechanismId }): string =>
  `run ${request.projectCommand} and commit every ${projectionFileOf(request)} it writes`;

const GENERATED_CONFIGURATION = "or, where a tool such as sku generates the configuration, last in the configuration the tool takes";

const notIncludedLine = (request: { readonly unmeasured: Extract<MechanismNotRun, { readonly projection: "not-included" }> }): string => {
  const { mechanism, nestedConfigurations } = request.unmeasured;
  const subject = `mechanism-not-run ${mechanism} not-included`;
  return nestedConfigurations.length === 0
    ? `${subject}: the ${mechanism} configuration does not apply ${projectionFileOf({ mechanism })}; spread its default export last in that configuration, after every other block (an import placed last without the spread applies nothing), ${GENERATED_CONFIGURATION}`
    : `${subject} ${nestedConfigurations.join(", ")}: the ${mechanism} configuration of those folders is not managed from this repository, as each holds its own disciplines.json, and it leaves records there out of effect; exclude those folders in this repository's disciplines.json and record their exceptions in each folder's own discipline-exceptions.json, as nested Hone configurations are not supported yet (${NESTED_CONFIGURATION_ISSUE})`;
};

const mechanismNotRunLine = (request: ProjectionRequest & { readonly unmeasured: MechanismNotRun }): string => {
  switch (request.unmeasured.projection) {
    case "missing":
      return `mechanism-not-run ${request.unmeasured.mechanism} missing: ${projectionFileOf(request.unmeasured)} is not written; ${refreshStep({ ...request, mechanism: request.unmeasured.mechanism })}`;
    case "not-included":
      return notIncludedLine({ unmeasured: request.unmeasured });
  }
};

type SliceProblem = Extract<ProjectionProblem, { readonly scope: "slice" }>;

const folderOf = (request: { readonly slice: RepoPath }): string => request.slice.split("/").slice(0, -1).join("/");

const sliceProblemReason = (request: ProjectionRequest & { readonly problem: SliceProblem }): string => {
  const { mechanism, slice } = request.problem;
  const folder = folderOf({ slice });
  switch (request.problem.state) {
    case "out-of-date":
      return `that slice differs from what hone project writes now; ${refreshStep({ ...request, mechanism })}`;
    case "missing":
      return `that slice is not written; ${refreshStep({ ...request, mechanism })}`;
    case "not-applied":
      return `the ${mechanism} configuration for ${folder} leaves records of that slice out of effect; spread the default export of ${slice} last in that package's configuration, in place of the root ${projectionFileOf({ mechanism })}, ${GENERATED_CONFIGURATION}`;
    case "unconfigured":
      return `${folder} has no ${mechanism} configuration file on disk, so nothing loads that slice; run the tool that generates it (for sku, sku configure) before the check`;
  }
};

const projectionProblemLine = (request: ProjectionRequest & { readonly problem: ProjectionProblem }): string => {
  const { problem } = request;
  switch (problem.scope) {
    case "projection":
      return `${problem.mechanism} ${problem.state}: ${projectionFileOf(problem)} differs from what hone project writes now; ${refreshStep({ ...request, mechanism: problem.mechanism })}`;
    case "slice":
      return `${problem.mechanism} ${problem.state} ${problem.slice}: ${sliceProblemReason({ ...request, problem })}`;
  }
};

const unmeasuredLine = (request: ProjectionRequest & { readonly unmeasured: Unmeasured }): string => {
  switch (request.unmeasured.kind) {
    case "forfeiture-unmeasured":
      return forfeitureLine(request.unmeasured);
    case "import-unmeasured":
    case "legacy-chain-unmeasured":
      return recordsLine({ unmeasured: request.unmeasured });
    case "mechanism-not-run":
      return mechanismNotRunLine({ ...request, unmeasured: request.unmeasured });
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

const assessmentFileLine = (request: { readonly note: AssessmentFileNote }): string => {
  switch (request.note.state) {
    case "not-written":
      return `Start from each rule's Spirit below. ${ASSESSMENT_FILE_NAME}, where this repository records its own causes, forward goal and steps for a clause, is not written yet; ${request.note.guide}#5a-write-the-assessment says how to write it.`;
    case "unreadable":
      return `Start from each rule's Spirit below. ${ASSESSMENT_FILE_NAME} could not be read.`;
  }
};

const readFirstLine = (request: { readonly entry: ReadFirstEntry }): string => {
  switch (request.entry.kind) {
    case "assessment-file":
      return assessmentFileLine({ note: request.entry });
    case "clause":
      return `${clauseAddressText({ address: request.entry.clause })}: ${pointedReading({ reading: request.entry })}${assessmentContext({ reading: request.entry })}`;
  }
};

type ReportLines = (request: ProjectionRequest & { readonly report: CheckReport }) => readonly string[];

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
  unmeasured: (request) => request.report.unmeasured.map((unmeasured) => unmeasuredLine({ ...request, unmeasured })),
  projectionProblems: (request) =>
    request.report.projectionProblems.map((problem) => projectionProblemLine({ ...request, problem })),
  assessment: (request) => request.report.assessment.map((partial) => assessmentLine({ partial })),
  readFirst: (request) => request.report.readFirst.map((entry) => readFirstLine({ entry })),
};

const reportSections = (request: ProjectionRequest & { readonly report: CheckReport }): readonly ReportSection[] =>
  SECTION_NAMES.map((name) => ({ name, lines: SECTION_LINES[name](request) }));

const verdictLine = (request: { readonly report: CheckReport }): string =>
  request.report.assessment.length === 0
    ? `verdict: ${verdictOf(request)}`
    : `verdict: ${verdictOf(request)} (partial assessment)`;

export const renderReportText = (
  request: ProjectionRequest & { readonly report: CheckReport; readonly output: ReportOutput },
): string => {
  const sectionLines = reportSections(request)
    .filter((section) => section.lines.length > 0)
    .flatMap((section) => printedSectionLines({ output: request.output, section }));
  return `${[...sectionLines, verdictLine(request)].join("\n")}\n`;
};
