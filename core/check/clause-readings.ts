import type { ClauseRoot } from "../consumer-selection/selection.ts";
import type { Finding } from "../governance/governance.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { ASSESSMENT_FILE_NAME, assessmentSectionHeading } from "../values/assessment-file.ts";
import { type ClauseAddress, clauseAddressText } from "../values/clause-address.ts";
import type { AssessmentSection, ClauseReading } from "../verdict/check-report.ts";

type AssessmentHeadings =
  | { readonly file: "read"; readonly headings: ReadonlySet<string> }
  | { readonly file: "no-file" | "unreadable" };

type ReadingRequest = {
  readonly repoRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
};

const failingClauses = (request: { readonly findings: readonly Finding[] }): readonly ClauseAddress[] => [
  ...new Map(request.findings.map((finding) => [clauseAddressText({ address: finding.clause }), finding.clause])).values(),
];

const assessmentHeadingsOf = (request: ReadingRequest): AssessmentHeadings => {
  const assessmentPath = request.path.join({ segments: [request.repoRoot, ASSESSMENT_FILE_NAME] });
  if (request.fileText.exists({ path: assessmentPath }) === "absent") {
    return { file: "no-file" };
  }
  const text = request.fileText.read({ path: assessmentPath });
  if (text.outcome === "failed") {
    return { file: "unreadable" };
  }
  return { file: "read", headings: new Set(text.value.split("\n").map((line) => line.trimEnd())) };
};

const assessmentSectionOf = (request: {
  readonly headings: AssessmentHeadings;
  readonly clause: ClauseAddress;
}): AssessmentSection => {
  if (request.headings.file !== "read") {
    return request.headings.file;
  }
  return request.headings.headings.has(assessmentSectionHeading(request)) ? "present" : "missing";
};

const shownPathOf = (request: ReadingRequest & { readonly page: string }): string => {
  const location = request.path.relative({ from: request.repoRoot, to: request.page });
  return location.relation === "within-root" ? location.path : request.page;
};

const clauseReadingOf = (
  request: ReadingRequest & { readonly headings: AssessmentHeadings; readonly clause: ClauseAddress; readonly page: string },
): ClauseReading => ({
  clause: request.clause,
  assessmentSection: assessmentSectionOf(request),
  rulePage: { path: shownPathOf(request), presence: request.fileText.exists({ path: request.page }) },
});

const rulePageOf = (request: { readonly root: ClauseRoot; readonly path: PathPort }): string =>
  request.path.join({ segments: [request.root.ruleSetRoot, "rules", request.root.clause.discipline, "README.md"] });

export const clauseReadingsOf = (
  request: ReadingRequest & { readonly findings: readonly Finding[]; readonly clauseRoots: readonly ClauseRoot[] },
): readonly ClauseReading[] => {
  const clauses = failingClauses(request);
  if (clauses.length === 0) {
    return [];
  }
  const headings = assessmentHeadingsOf(request);
  return clauses.flatMap((clause) =>
    request.clauseRoots
      .filter((root) => clauseAddressText({ address: root.clause }) === clauseAddressText({ address: clause }))
      .map((root) => clauseReadingOf({ ...request, headings, clause, page: rulePageOf({ root, path: request.path }) })),
  );
};
