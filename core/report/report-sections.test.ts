import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../values/repo-path.ts";
import { RUN_SECTION_NAMES, type RunSectionName, type RunSectionRole, runSectionRoleOf, runVerdictOf } from "./report-sections.ts";
import type { RunReport } from "./run-report.ts";

const EMPTY_REPORT: RunReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
  findings: [],
  answered: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  refused: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  notes: [],
  carried: [],
  symptoms: [],
};

describe("RUN_SECTION_NAMES", () => {
  it("names every section in the order the report prints them", () => {
    expect(RUN_SECTION_NAMES).toEqual([
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
    ]);
  });
});

describe("runSectionRoleOf", () => {
  it.each<{ readonly section: RunSectionName; readonly role: RunSectionRole }>([
    { section: "findings", role: "failing" },
    { section: "answered", role: "informational" },
    { section: "doublyHeld", role: "failing" },
    { section: "refused", role: "failing" },
    { section: "notes", role: "informational" },
    { section: "carried", role: "informational" },
    { section: "symptoms", role: "guidance" },
  ])("gives $section the role $role", ({ section, role }) => {
    expect(runSectionRoleOf({ section })).toBe(role);
  });
});

describe("runVerdictOf", () => {
  it("passes a run whose failing sections are all empty, whatever its informational sections hold", () => {
    expect(runVerdictOf({ report: { ...EMPTY_REPORT, excluded: [repoPathSchema.parse("dist")], notes: [{ kind: "declared-not-read", key: "layers" }] } })).toBe("pass");
  });

  it("fails a run with an entry in a failing section", () => {
    expect(runVerdictOf({ report: { ...EMPTY_REPORT, refused: [{ place: { file: repoPathSchema.parse("hone-records/boundaries.json"), index: 0 }, refusals: [{ kind: "carried-changed-since-base" }] }] } })).toBe(
      "fail",
    );
  });
});
