import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { mechanismIdSchema } from "../core/values/identifiers.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import type { CheckReport } from "../core/verdict/check-report.ts";
import { contractGaps, documentedLinesIn, documentedRolesIn, reportLinesOf } from "./output-contract.ts";

const DOC =
  "| Section | Role |\n| --- | --- |\n| `findings` | failing | each place a clause is broken |\n\n| Section | Line |\n| --- | --- |\n| `findings` | `<clause> <mechanism> <file>:<line>:<column> <snippet>` |\n| `verdict` | `verdict: fail (partial assessment)` |\n| `<clause>` | a clause address |\n";

const REPORT: CheckReport = {
  excluded: [repoPathSchema.parse("generated")],
  notAdopted: [],
  notRun: [],
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

describe("documentedLinesIn", () => {
  it("reads each table row whose two cells are both code as a label and a template", () => {
    expect(documentedLinesIn({ text: DOC })).toEqual([
      { label: "findings", text: "<clause> <mechanism> <file>:<line>:<column> <snippet>" },
      { label: "verdict", text: "verdict: fail (partial assessment)" },
    ]);
  });
});

describe("documentedRolesIn", () => {
  it("reads each row that names a section and its role", () => {
    expect(documentedRolesIn({ text: DOC })).toEqual([{ section: "findings", role: "failing" }]);
  });
});

describe("contractGaps", () => {
  it("matches a printed line to a template under the same label, a placeholder standing for any text", () => {
    expect(
      contractGaps({
        documented: [{ label: "findings", text: "<clause> <mechanism> <file>:<line>:<column> <snippet>" }],
        printed: [{ label: "findings", text: "CD-15#loops audit src/a.ts:2:0 const total = 0;" }],
      }),
    ).toEqual({ undocumented: [], unprinted: [] });
  });

  it("names a printed line no template fits and a template no printed line fits", () => {
    expect(
      contractGaps({
        documented: [{ label: "verdict", text: "verdict: pass (partial assessment)" }],
        printed: [{ label: "verdict", text: "verdict: pass" }],
      }),
    ).toEqual({
      undocumented: [{ label: "verdict", text: "verdict: pass" }],
      unprinted: [{ label: "verdict", text: "verdict: pass (partial assessment)" }],
    });
  });

  it("reads the literal parts of a template literally", () => {
    expect(
      contractGaps({ documented: [{ label: "heading", text: "<section> (<count>)" }], printed: [{ label: "heading", text: "findings 1" }] }),
    ).toMatchObject({ undocumented: [{ text: "findings 1" }] });
  });
});

describe("reportLinesOf", () => {
  it("labels each heading, each entry by its section, and the verdict", () => {
    expect(reportLinesOf({ report: REPORT, output: "full" })).toEqual([
      { label: "heading", text: "excluded (1)" },
      { label: "excluded", text: "generated" },
      { label: "heading", text: "findings (1)" },
      { label: "findings", text: "CD-15#loops audit src/a.ts:2:0 const total = 0;" },
      { label: "verdict", text: "verdict: fail" },
    ]);
  });

  it("labels each counts line as a heading", () => {
    expect(reportLinesOf({ report: REPORT, output: "counts" })).toEqual([
      { label: "heading", text: "excluded (1) informational" },
      { label: "heading", text: "findings (1)" },
      { label: "verdict", text: "verdict: fail" },
    ]);
  });
});
