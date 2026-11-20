import type { RunReport } from "./run-report.ts";

export type RunSectionName = keyof RunReport;

export type RunSectionRole = "failing" | "informational" | "guidance";

export type RunVerdict = "pass" | "fail";

const RUN_SECTION_ROLES: Readonly<Record<RunSectionName, RunSectionRole>> = {
  excluded: "informational",
  notAdopted: "informational",
  notRun: "informational",
  editions: "informational",
  findings: "failing",
  answered: "informational",
  uncovered: "failing",
  stale: "failing",
  forfeited: "failing",
  unrecorded: "failing",
  doublyHeld: "failing",
  refused: "failing",
  unmeasured: "failing",
  projectionProblems: "failing",
  assessment: "informational",
  notes: "informational",
  carried: "informational",
  symptoms: "guidance",
};

export const RUN_SECTION_NAMES: readonly RunSectionName[] = [
  "excluded",
  "notAdopted",
  "notRun",
  "editions",
  "findings",
  "answered",
  "uncovered",
  "stale",
  "forfeited",
  "unrecorded",
  "doublyHeld",
  "refused",
  "unmeasured",
  "projectionProblems",
  "assessment",
  "notes",
  "carried",
  "symptoms",
];

export const runSectionRoleOf = (request: { readonly section: RunSectionName }): RunSectionRole => RUN_SECTION_ROLES[request.section];

export const runVerdictOf = (request: { readonly report: RunReport }): RunVerdict =>
  RUN_SECTION_NAMES.filter((section) => runSectionRoleOf({ section }) === "failing").every((section) => request.report[section].length === 0) ? "pass" : "fail";
