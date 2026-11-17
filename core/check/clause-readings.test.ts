import { describe, expect, it, vi } from "vitest";
import type { Finding } from "../governance/governance.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import { clauseReadingsOf } from "./clause-readings.ts";

type FakeFile = {
  readonly read: Result<string, { readonly kind: "unreadable"; readonly path: string; readonly detail: string }>;
  readonly presence: "present" | "absent";
};

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } },
  presence: "absent",
};

const UNREADABLE_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "/repo/disciplines.assessment.md", detail: "EACCES" } },
  presence: "present",
};

const fileOf = (request: { readonly files: Readonly<Record<string, FakeFile>>; readonly path: string }): FakeFile =>
  request.files[request.path] ?? ABSENT_FILE;

const filesOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => fileOf({ files, path }).read,
  exists: ({ path }) => fileOf({ files, path }).presence,
  write: vi.fn<FileTextPort["write"]>(),
});

const REPO_ROOT = absolutePathSchema.parse("/repo");

const ASSESSMENT_PATH = "/repo/disciplines.assessment.md";

const LOOPS = clauseAddressSchema.parse("CD-15#loops");

const CLASS_SYNTAX = clauseAddressSchema.parse("CD-14#class-syntax");

const TEAM_CLAUSE = clauseAddressSchema.parse("team/TM-1#no-tmp-files");

const LOOPS_PAGE = "/repo/node_modules/@hailstails/hone/rules/CD-15/README.md";

const CLASS_SYNTAX_PAGE = "/repo/node_modules/@hailstails/hone/rules/CD-14/README.md";

const SHIPPED_ROOT = absolutePathSchema.parse("/repo/node_modules/@hailstails/hone");

const CLAUSE_ROOTS = [
  { clause: LOOPS, ruleSetRoot: SHIPPED_ROOT },
  { clause: CLASS_SYNTAX, ruleSetRoot: SHIPPED_ROOT },
  { clause: TEAM_CLAUSE, ruleSetRoot: absolutePathSchema.parse("/repo/team-rules") },
];

const findingOn = (request: { readonly clause: Finding["clause"]; readonly file: string }): Finding => ({
  clause: request.clause,
  mechanism: mechanismIdSchema.parse("audit"),
  file: repoPathSchema.parse(request.file),
  anchor: { line: 1, column: 0 },
  snippet: "const total = 0;",
});

const SHIPPED_PAGES: Readonly<Record<string, FakeFile>> = {
  [LOOPS_PAGE]: presentFile({ text: "# CD-15\n" }),
  [CLASS_SYNTAX_PAGE]: presentFile({ text: "# CD-14\n" }),
};

const readingsOver = (request: { readonly files: FileTextPort; readonly findings: readonly Finding[] }) =>
  clauseReadingsOf({
    findings: request.findings,
    clauseRoots: CLAUSE_ROOTS,
    repoRoot: REPO_ROOT,
    fileText: request.files,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  });

const LOOPS_PAGE_TEXT = "node_modules/@hailstails/hone/rules/CD-15/README.md";

describe("clauseReadingsOf", () => {
  it("reads nothing and points nowhere when there are no findings", () => {
    const files = filesOver(SHIPPED_PAGES);
    const reads = vi.spyOn(files, "read");
    const checks = vi.spyOn(files, "exists");

    expect({ readings: readingsOver({ files, findings: [] }), reads: reads.mock.calls, checks: checks.mock.calls }).toEqual({
      readings: [],
      reads: [],
      checks: [],
    });
  });

  it("points once per failing clause, in the order the findings first name them", () => {
    const files = filesOver({ ...SHIPPED_PAGES, [ASSESSMENT_PATH]: presentFile({ text: "# Disciplines assessment\n\n## CD-15#loops\n\n- **Cause here:** x\n" }) });

    expect(
      readingsOver({
        files,
        findings: [
          findingOn({ clause: LOOPS, file: "src/a.ts" }),
          findingOn({ clause: CLASS_SYNTAX, file: "src/a.ts" }),
          findingOn({ clause: LOOPS, file: "src/b.ts" }),
        ],
      }),
    ).toEqual([
      { clause: LOOPS, assessmentSection: "present", rulePage: { path: LOOPS_PAGE_TEXT, presence: "present" } },
      {
        clause: CLASS_SYNTAX,
        assessmentSection: "missing",
        rulePage: { path: "node_modules/@hailstails/hone/rules/CD-14/README.md", presence: "present" },
      },
    ]);
  });

  it("reads the assessment file once however many clauses fail", () => {
    const files = filesOver({ ...SHIPPED_PAGES, [ASSESSMENT_PATH]: presentFile({ text: "## CD-15#loops\n" }) });
    const reads = vi.spyOn(files, "read");
    readingsOver({ files, findings: [findingOn({ clause: LOOPS, file: "src/a.ts" }), findingOn({ clause: CLASS_SYNTAX, file: "src/a.ts" })] });

    expect(reads.mock.calls).toEqual([[{ path: ASSESSMENT_PATH }]]);
  });
});

describe("clauseReadingsOf matching a clause's section", () => {
  it.each([
    { shape: "a heading with trailing spaces and a carriage return", text: "## CD-15#loops  \r\n", expected: "present" },
    { shape: "the address only inside the section's text", text: "## Loops\n\nCD-15#loops is high-count here.\n", expected: "missing" },
    { shape: "a level-3 heading", text: "### CD-15#loops\n", expected: "missing" },
    { shape: "a heading with more than the address", text: "## CD-15#loops in src/\n", expected: "missing" },
    { shape: "a heading with the rule set named", text: "## hone/CD-15#loops\n", expected: "missing" },
  ])("finds the section only by a level-2 heading that is exactly the clause address, given $shape", ({ text, expected }) => {
    expect(
      readingsOver({ files: filesOver({ ...SHIPPED_PAGES, [ASSESSMENT_PATH]: presentFile({ text }) }), findings: [findingOn({ clause: LOOPS, file: "src/a.ts" })] }),
    ).toMatchObject([{ assessmentSection: expected }]);
  });

  it.each([
    { state: "absent", assessment: ABSENT_FILE, expected: "no-file" },
    { state: "unreadable", assessment: UNREADABLE_FILE, expected: "unreadable" },
  ])("says so when the assessment file is $state, and still points at the rule page", ({ assessment, expected }) => {
    expect(
      readingsOver({ files: filesOver({ ...SHIPPED_PAGES, [ASSESSMENT_PATH]: assessment }), findings: [findingOn({ clause: LOOPS, file: "src/a.ts" })] }),
    ).toEqual([{ clause: LOOPS, assessmentSection: expected, rulePage: { path: LOOPS_PAGE_TEXT, presence: "present" } }]);
  });
});

describe("clauseReadingsOf pointing at the rule page", () => {
  it("names a team rule set's page and says when it has none", () => {
    expect(
      readingsOver({ files: filesOver({ [ASSESSMENT_PATH]: ABSENT_FILE }), findings: [findingOn({ clause: TEAM_CLAUSE, file: "src/a.ts" })] }),
    ).toEqual([
      { clause: TEAM_CLAUSE, assessmentSection: "no-file", rulePage: { path: "team-rules/rules/TM-1/README.md", presence: "absent" } },
    ]);
  });

  it("names the page by its absolute path when it is on another root than the repository", () => {
    expect(
      clauseReadingsOf({
        findings: [findingOn({ clause: LOOPS, file: "src/a.ts" })],
        clauseRoots: [{ clause: LOOPS, ruleSetRoot: absolutePathSchema.parse("D:\\hone") }],
        repoRoot: absolutePathSchema.parse("C:\\repo"),
        fileText: filesOver({ "D:\\hone\\rules\\CD-15\\README.md": presentFile({ text: "# CD-15\n" }) }),
        path: createPathPort({ flavour: "windows", workingDirectory: () => "C:\\repo" }),
      }),
    ).toEqual([
      { clause: LOOPS, assessmentSection: "no-file", rulePage: { path: "D:\\hone\\rules\\CD-15\\README.md", presence: "present" } },
    ]);
  });
});
