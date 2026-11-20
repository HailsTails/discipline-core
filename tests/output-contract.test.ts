import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { mechanismIdSchema } from "../core/values/identifiers.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import type { Case, Principle, RecordKind, Rule, Symptom } from "../core/symptom-catalogue/symptom-catalogue.ts";
import type { CheckReport } from "../core/verdict/check-report.ts";
import { NO_SYMPTOM_GUIDE, type SymptomGuide } from "../core/verdict/symptom-notes.ts";
import { contractGaps, documentedLinesIn, documentedRolesIn, type EntryFills, filledTemplate, reportLinesOf } from "./output-contract.ts";

const DOC =
  "| Section | Role |\n| --- | --- |\n| `findings` | failing | each place a clause is broken |\n\n| Section | Line |\n| --- | --- |\n| `findings` | `<clause> <mechanism> <file>:<line>:<column> <snippet>` |\n| `verdict` | `verdict: fail (partial assessment)` |\n| `<clause>` | a clause address |\n";

const FINDING_FILLS = { clause: "CD-15#loops", mechanism: "audit", file: "src/a.ts", line: "2", column: "0", snippet: "const total = 0;" };

const FINDING_TEMPLATE = { label: "findings", template: "<clause> <mechanism> <file>:<line>:<column> <snippet>" };

const REPORT: CheckReport = {
  excluded: [repoPathSchema.parse("generated")],
  notAdopted: [],
  notRun: [],
  editions: [],
  findings: [
    {
      clause: clauseAddressSchema.parse("CD-15#loops"),
      mechanism: mechanismIdSchema.parse("audit"),
      file: repoPathSchema.parse("src/a.ts"),
      anchor: { line: 2, column: 0 },
      snippet: "const total = 0;",
    },
  ],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  readFirst: [],
};

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const DOER_OR_ORCHESTRATOR: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const MAKES_A_NEW_VALUE: Case = {
  name: "makes-a-new-value-from-what-it-has",
  title: "Makes a new value from what it has",
  standing: "accepted",
  owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }],
};

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const LOOP_STATEMENT: Symptom = {
  name: "loop-statement",
  title: "Loop statement",
  seen: "A for or while statement.",
  mayIndicate: [{ case: MAKES_A_NEW_VALUE, points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] }],
  breachUsuallySits: "in the unit that builds the value",
  recipes: [],
  correctUses: [],
};

const LOOPS_GUIDE: SymptomGuide = {
  guide: "catalogue",
  page: "rules/typescript/symptoms.md",
  catalogue: {
    principles: [ONE_PLACE_DECIDES],
    rules: [DOER_OR_ORCHESTRATOR],
    cases: [MAKES_A_NEW_VALUE],
    recipes: [],
    recordKinds: [AUTHORISED_LOCATION, DEBT],
    alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
    engines: [],
    symptoms: [LOOP_STATEMENT],
    clauses: [{ clause: clauseAddressSchema.parse("CD-15#loops"), sight: { kind: "one-symptom", symptom: LOOP_STATEMENT } }],
    checks: [],
    namedBans: [],
  },
};

const positionFills: EntryFills = ({ section, position }) => ({ section, position: String(position) });

describe("documentedLinesIn", () => {
  it("reads each table row whose two cells are both code as a label and a template", () => {
    expect(documentedLinesIn({ text: DOC })).toEqual([FINDING_TEMPLATE, { label: "verdict", template: "verdict: fail (partial assessment)" }]);
  });
});

describe("documentedRolesIn", () => {
  it("reads each row that names a section and its role", () => {
    expect(documentedRolesIn({ text: DOC })).toEqual([{ section: "findings", role: "failing" }]);
  });
});

describe("filledTemplate", () => {
  it("puts each placeholder's fill in its place and leaves a placeholder with no fill as written", () => {
    expect(filledTemplate({ template: "<clause> <mechanism> <rest>", fills: { clause: "CD-15#loops", mechanism: "audit" } })).toBe(
      "CD-15#loops audit <rest>",
    );
  });
});

describe("contractGaps", () => {
  it("matches a printed line whose text is its template filled with its own sample values", () => {
    expect(
      contractGaps({
        documented: [FINDING_TEMPLATE],
        printed: [{ label: "findings", text: "CD-15#loops audit src/a.ts:2:0 const total = 0;", fills: FINDING_FILLS }],
      }),
    ).toEqual({ undocumented: [], unprinted: [] });
  });

  it("refuses a printed line whose fields come in another order than the template's", () => {
    expect(
      contractGaps({
        documented: [FINDING_TEMPLATE],
        printed: [{ label: "findings", text: "audit CD-15#loops src/a.ts:2:0 const total = 0;", fills: FINDING_FILLS }],
      }),
    ).toMatchObject({ undocumented: [{ text: "audit CD-15#loops src/a.ts:2:0 const total = 0;" }], unprinted: [FINDING_TEMPLATE] });
  });

  it("refuses a printed line whose separators differ from the template's", () => {
    expect(
      contractGaps({
        documented: [FINDING_TEMPLATE],
        printed: [{ label: "findings", text: "CD-15#loops -- audit src/a.ts:2:0 const total = 0;", fills: FINDING_FILLS }],
      }),
    ).toMatchObject({ unprinted: [FINDING_TEMPLATE] });
  });

  it("names a printed line no template fits and a template no printed line fits", () => {
    expect(
      contractGaps({
        documented: [{ label: "verdict", template: "verdict: pass (partial assessment)" }],
        printed: [{ label: "verdict", text: "verdict: pass", fills: {} }],
      }),
    ).toEqual({
      undocumented: [{ label: "verdict", text: "verdict: pass", fills: {} }],
      unprinted: [{ label: "verdict", template: "verdict: pass (partial assessment)" }],
    });
  });
});

describe("reportLinesOf", () => {
  it("labels each heading with its section and count, each entry by its section and position, and the verdict", () => {
    expect(reportLinesOf({ report: REPORT, output: "full", projectCommand: "node hone.js project --repo /repo", pruneCommand: "node hone.js prune-debt --repo /repo", eslintProjection: "javascript", entryFills: positionFills, guide: NO_SYMPTOM_GUIDE })).toEqual([
      { label: "heading", text: "excluded (1)", fills: { section: "excluded", count: "1" } },
      { label: "excluded", text: "generated", fills: { section: "excluded", position: "0" } },
      { label: "heading", text: "findings (1)", fills: { section: "findings", count: "1" } },
      { label: "findings", text: "CD-15#loops audit src/a.ts:2:0 const total = 0;", fills: { section: "findings", position: "0" } },
      { label: "verdict", text: "verdict: fail", fills: {} },
    ]);
  });

  it("labels a symptom note as a readFirst entry, under a heading that counts it", () => {
    expect(
      reportLinesOf({
        report: { ...REPORT, excluded: [] },
        output: "full",
        projectCommand: "node hone.js project --repo /repo",
        pruneCommand: "node hone.js prune-debt --repo /repo", eslintProjection: "javascript",
        entryFills: positionFills,
        guide: LOOPS_GUIDE,
      }),
    ).toEqual([
      { label: "heading", text: "findings (1)", fills: { section: "findings", count: "1" } },
      {
        label: "findings",
        text: "CD-15#loops audit src/a.ts:2:0 const total = 0; symptom: loop-statement, may indicate: doer-or-orchestrator",
        fills: { section: "findings", position: "0" },
      },
      { label: "heading", text: "readFirst (1)", fills: { section: "readFirst", count: "1" } },
      {
        label: "readFirst",
        text: "loop-statement: Loop statement. May indicate: makes a new value from what it has → Doer or orchestrator. The breach usually sits in the unit that builds the value. Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#loop-statement",
        fills: { section: "readFirst", position: "0" },
      },
      { label: "verdict", text: "verdict: fail", fills: {} },
    ]);
  });

  it("labels each counts line as a heading", () => {
    expect(reportLinesOf({ report: REPORT, output: "counts", projectCommand: "node hone.js project --repo /repo", pruneCommand: "node hone.js prune-debt --repo /repo", eslintProjection: "javascript", entryFills: positionFills, guide: NO_SYMPTOM_GUIDE })).toEqual([
      { label: "heading", text: "excluded (1) informational", fills: { section: "excluded", count: "1" } },
      { label: "heading", text: "findings (1)", fills: { section: "findings", count: "1" } },
      { label: "verdict", text: "verdict: fail", fills: {} },
    ]);
  });
});
