import { describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../tests/causal-why-chain.ts";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { Finding } from "../governance/governance.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { reportOutputSchema } from "../values/report-output.ts";
import type { CheckReport, ClauseReading, PartialAssessment } from "./check-report.ts";
import { renderReportText } from "./report-text.ts";

const noClass = clauseAddressSchema.parse("CD-14#no-class-syntax");
const probeNoTmp = clauseAddressSchema.parse("probe/PD-1#no-tmp-files");
const fileA = repoPathSchema.parse("src/a.ts");
const packageJson = repoPathSchema.parse("package.json");
const suppressions = repoPathSchema.parse("eslint-suppressions.json");
const audit = mechanismIdSchema.parse("audit");
const eslint = mechanismIdSchema.parse("eslint");

const finding: Finding = {
  clause: noClass,
  file: fileA,
  anchor: { line: 3, column: 5 },
  snippet: "class A {}",
  mechanism: audit,
};

const located: ExceptionRecord = {
  kind: "authorised-location",
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/verdict/report-text.test.ts#located; not historical authorisation" },
  clause: noClass,
  mechanism: audit,
  file: fileA,
  reason: "the adapter factory wraps the parser's class",
};

const carved: ExceptionRecord = {
  kind: "file-carve-out",
  clause: noClass,
  mechanism: audit,
  file: fileA,
  reason: "the parser adapter is unpaid debt",
  whyChain: CAUSAL_WHY_CHAIN,
};

const carvedEverywhere: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: noClass,
  mechanism: audit,
  reason: "the whole clause is unpaid debt",
  whyChain: CAUSAL_WHY_CHAIN,
};

const emptyReport: CheckReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  findings: [],
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

describe("renderReportText entry lines", () => {
  it("renders a finding as clause, mechanism, file:line:column and snippet", () => {
    expect(
      renderReportText({ output: "full", report: { ...emptyReport, findings: [finding] } }),
    ).toContain("\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\n");
  });

  it("renders the excluded paths first, one per line, before any finding", () => {
    expect(
      renderReportText({
        output: "full",
        report: { ...emptyReport, excluded: [repoPathSchema.parse("generated"), repoPathSchema.parse("src/legacy.ts")], findings: [finding] },
      }),
    ).toBe(
      "excluded (2)\ngenerated\nsrc/legacy.ts\nfindings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nverdict: fail\n",
    );
  });

  it("renders an exempted finding followed by the kind of each crediting record", () => {
    expect(
      renderReportText({
        output: "full",
        report: { ...emptyReport, exempted: [{ finding, by: [carved, carvedEverywhere] }] },
      }),
    ).toContain(
      "\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {} exempted by file-carve-out exempted by clause-wide-carve-out\n",
    );
  });

  it("renders an uncovered clause as its address text", () => {
    expect(
      renderReportText({ output: "full", report: { ...emptyReport, uncovered: [probeNoTmp] } }),
    ).toContain("\nprobe/PD-1#no-tmp-files\n");
  });

  it("renders a stale authorised location as clause, mechanism, kind and file", () => {
    expect(
      renderReportText({ output: "full", report: { ...emptyReport, stale: [located] } }),
    ).toContain("\nCD-14#no-class-syntax audit authorised-location src/a.ts\n");
  });

  it("renders a stale clause-wide carve-out with * for its file", () => {
    expect(
      renderReportText({ output: "full", report: { ...emptyReport, stale: [carvedEverywhere] } }),
    ).toContain("\nCD-14#no-class-syntax audit clause-wide-carve-out *\n");
  });

  it("renders a forfeited file carve-out as clause, mechanism, kind and file", () => {
    expect(
      renderReportText({ output: "full", report: { ...emptyReport, forfeited: [carved] } }),
    ).toContain("\nCD-14#no-class-syntax audit file-carve-out src/a.ts\n");
  });

  it("renders a doubly-held entry as clause, mechanism, doubly-held and file", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          doublyHeld: [{ clause: noClass, file: fileA, mechanism: audit }],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax audit doubly-held src/a.ts\n");
  });

  it("renders an unrecorded ignore as clause, mechanism, kind and file", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [{ kind: "ignore", clause: noClass, file: fileA, mechanism: eslint }],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint ignore src/a.ts\n");
  });

  it("renders an unrecorded config override as clause, mechanism, kind and file", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            { kind: "config-override", clause: noClass, file: fileA, mechanism: eslint },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint config-override src/a.ts\n");
  });

  it("renders an unrecorded suppression entry with its location", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "suppression-entry",
              clause: noClass,
              file: fileA,
              location: suppressions,
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint suppression-entry src/a.ts eslint-suppressions.json\n");
  });

  it("renders a finding whose snippet holds line breaks on one line with each break escaped", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          findings: [{ ...finding, snippet: "class A {\n}\r\nclass B {}" }],
        },
      }),
    ).toContain(String.raw`
CD-14#no-class-syntax audit src/a.ts:3:5 class A {\n}\r\nclass B {}
`);
  });

  it("renders an unrecorded inline disable whose text holds line breaks on one line with each break escaped", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "inline-disable",
              clause: noClass,
              file: fileA,
              line: 7,
              text: "/* eslint-disable\nno-class */\r",
              reach: "one-clause",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain(String.raw`
CD-14#no-class-syntax eslint inline-disable src/a.ts:7 /* eslint-disable\nno-class */\r
`);
  });

  it("renders a command-line option whose script and option hold line breaks on one line with each break escaped", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "command-line-option",
              clause: noClass,
              location: packageJson,
              script: "lint\r\nfix",
              option: "--rule\nno-class:off",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain(String.raw`
CD-14#no-class-syntax eslint command-line-option package.json lint\r\nfix --rule\nno-class:off weakens the script's whole run, so no record can cover it: remove it from the script
`);
  });

  it("renders an invalid record whose detail holds line breaks on one line with each break escaped", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            {
              index: 4,
              problem: { kind: "why-chain-refused", detail: "why 2\nis empty\r" },
            },
          ],
        },
      }),
    ).toContain(String.raw`
exceptions[4] why-chain-refused why 2\nis empty\r
`);
  });

  it("renders an unrecorded inline disable with its line and text", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "inline-disable",
              clause: noClass,
              file: fileA,
              line: 7,
              text: "// eslint-disable-line no-class",
              reach: "one-clause",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint inline-disable src/a.ts:7 // eslint-disable-line no-class\n");
  });

  it("renders an unrecorded inline disable that names no rule with the cheap fix after its text", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "inline-disable",
              clause: noClass,
              file: fileA,
              line: 1,
              text: "/* eslint-disable */",
              reach: "every-selected-clause",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain(
      "\nCD-14#no-class-syntax eslint inline-disable src/a.ts:1 /* eslint-disable */ names no rule and escapes every selected clause: naming the rule is the cheap fix\n",
    );
  });

  it("renders an unrecorded inline rule config with its line and text", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "inline-rule-config",
              clause: noClass,
              file: fileA,
              line: 2,
              text: "/* eslint no-class: off */",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint inline-rule-config src/a.ts:2 /* eslint no-class: off */\n");
  });

  it("renders an unrecorded command-line option as its location, script and option", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "command-line-option",
              clause: noClass,
              location: packageJson,
              script: "lint",
              option: "--rule no-class:off",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint command-line-option package.json lint --rule no-class:off weakens the script's whole run, so no record can cover it: remove it from the script\n");
  });

  it("renders an invalid record that carries a detail as its index, problem kind and detail", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            {
              index: 2,
              problem: { kind: "clause-unparseable", detail: "is not a clause address" },
            },
          ],
        },
      }),
    ).toContain("\nexceptions[2] clause-unparseable is not a clause address\n");
  });

  it("renders a refused why chain as its index, problem kind and detail", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            {
              index: 0,
              problem: { kind: "why-chain-refused", detail: "`whyChain.owner` is required" },
            },
          ],
        },
      }),
    ).toContain("\nexceptions[0] why-chain-refused `whyChain.owner` is required\n");
  });

  it("renders a clause-not-selected invalid record with the clause's address text", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            { index: 3, problem: { kind: "clause-not-selected", clause: probeNoTmp } },
          ],
        },
      }),
    ).toContain("\nexceptions[3] clause-not-selected probe/PD-1#no-tmp-files\n");
  });

  it("renders a file-not-repo-path invalid record with the refused file", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            { index: 3, problem: { kind: "file-not-repo-path", file: "/abs/a.ts" } },
          ],
        },
      }),
    ).toContain("\nexceptions[3] file-not-repo-path /abs/a.ts\n");
  });

  it("renders a duplicate invalid record with the index it duplicates", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [{ index: 3, problem: { kind: "duplicate", ofIndex: 1 } }],
        },
      }),
    ).toContain("\nexceptions[3] duplicate of 1\n");
  });

  it("renders a forfeiture-unmeasured entry as its kind", () => {
    expect(
      renderReportText({
        output: "full",
        report: { ...emptyReport, unmeasured: [{ kind: "forfeiture-unmeasured" }] },
      }),
    ).toContain("\nforfeiture-unmeasured\n");
  });

  it("renders a legacy-chain-unmeasured entry as its kind", () => {
    expect(
      renderReportText({
        output: "full",
        report: { ...emptyReport, unmeasured: [{ kind: "legacy-chain-unmeasured" }] },
      }),
    ).toContain("\nlegacy-chain-unmeasured\n");
  });

  it("renders a mechanism-not-run entry as its kind, mechanism and projection", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          unmeasured: [{ kind: "mechanism-not-run", mechanism: eslint, projection: "missing" }],
        },
      }),
    ).toContain("\nmechanism-not-run eslint missing\n");
  });

  it("renders a projection problem as its mechanism and out-of-date", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          projectionProblems: [{ scope: "projection", mechanism: eslint, state: "out-of-date" }],
        },
      }),
    ).toContain("\neslint out-of-date\n");
  });

  it("renders a package slice problem as its mechanism, state and the slice it names", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          projectionProblems: [
            { scope: "slice", mechanism: eslint, state: "not-applied", slice: repoPathSchema.parse("packages/a/disciplines.eslint.mjs") },
          ],
        },
      }),
    ).toContain("\neslint not-applied packages/a/disciplines.eslint.mjs\n");
  });

  it("explains a not-included projection in the failures-only output by the folders holding their own disciplines.json, without marking the verdict partial", () => {
    expect(
      renderReportText({
        output: "failures-only",
        report: {
          ...emptyReport,
          unmeasured: [
            {
              kind: "mechanism-not-run",
              mechanism: eslint,
              projection: "not-included",
              nestedConfigurations: repoPathSchema.array().parse(["fixtures/a", "fixtures/b"]),
            },
          ],
        },
      }),
    ).toBe(
      "unmeasured (1)\nmechanism-not-run eslint not-included; not managed from this repository, each holding its own disciplines.json: fixtures/a, fixtures/b; nested Hone configurations are not supported yet, see https://github.com/HailsTails/hone/issues/72\nverdict: fail\n",
    );
  });

  it("renders a not-included projection with no folder holding its own disciplines.json as its kind, mechanism and projection alone", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          unmeasured: [{ kind: "mechanism-not-run", mechanism: eslint, projection: "not-included", nestedConfigurations: [] }],
        },
      }),
    ).toContain("\nmechanism-not-run eslint not-included\n");
  });
});

describe("renderReportText sections", () => {
  it("heads a section with its field name and its count", () => {
    expect(
      renderReportText({ output: "full", report: { ...emptyReport, stale: [located, carvedEverywhere] } }),
    ).toMatch(/^stale \(2\)$/m);
  });

  it("renders a section's entries in the list's order beneath its header", () => {
    expect(
      renderReportText({ output: "full", report: { ...emptyReport, stale: [located, carvedEverywhere] } }),
    ).toContain(
      "stale (2)\nCD-14#no-class-syntax audit authorised-location src/a.ts\nCD-14#no-class-syntax audit clause-wide-carve-out *\n",
    );
  });

  it("orders sections as the report's fields are ordered", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          projectionProblems: [{ scope: "projection", mechanism: eslint, state: "out-of-date" }],
          stale: [located],
          findings: [finding],
        },
      }),
    ).toMatch(/^findings \(1\)$[\s\S]*^stale \(1\)$[\s\S]*^projectionProblems \(1\)$/m);
  });

  it("leaves out the section of an empty list", () => {
    expect(
      renderReportText({ output: "full", report: { ...emptyReport, findings: [finding] } }),
    ).not.toMatch(/^stale \(/m);
  });

  it("renders a report with one finding and one stale record exactly, ending with verdict: fail", () => {
    expect(
      renderReportText({ output: "full", report: { ...emptyReport, findings: [finding], stale: [located] } }),
    ).toBe(
      "findings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nstale (1)\nCD-14#no-class-syntax audit authorised-location src/a.ts\nverdict: fail\n",
    );
  });

  it("renders a report whose only entries are exempted exactly, ending with verdict: pass", () => {
    expect(
      renderReportText({
        output: "full",
        report: { ...emptyReport, exempted: [{ finding, by: [located] }] },
      }),
    ).toBe(
      "exempted (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {} exempted by authorised-location imported from fictional unit fixture core/verdict/report-text.test.ts#located; not historical authorisation\nverdict: pass\n",
    );
  });

  it("names no import for an exempting record that gives only a reason", () => {
    const reasoned: ExceptionRecord = { kind: "authorised-location", clause: noClass, mechanism: audit, file: fileA, reason: located.reason };

    expect(
      renderReportText({
        output: "full",
        report: { ...emptyReport, exempted: [{ finding, by: [reasoned] }] },
      }),
    ).toBe("exempted (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {} exempted by authorised-location\nverdict: pass\n");
  });

  it("renders an empty report as exactly the pass verdict line", () => {
    expect(renderReportText({ output: "full", report: emptyReport })).toBe("verdict: pass\n");
  });

  it("renders a refused file holding a forged verdict line as one escaped line", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            { index: 0, problem: { kind: "file-not-repo-path", file: "/x\nverdict: pass" } },
          ],
        },
      }),
    ).toBe(String.raw`invalidRecords (1)
exceptions[0] file-not-repo-path /x\nverdict: pass
verdict: fail
`);
  });
});

const mixedReport: CheckReport = {
  ...emptyReport,
  excluded: [repoPathSchema.parse("generated")],
  findings: [finding],
  exempted: [{ finding, by: [carved] }],
  stale: [located, carvedEverywhere],
};

describe("renderReportText outputs", () => {
  it("renders every section of a failing report for the full output", () => {
    expect(renderReportText({ output: "full", report: mixedReport })).toBe(
      "excluded (1)\ngenerated\nfindings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nexempted (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {} exempted by file-carve-out\nstale (2)\nCD-14#no-class-syntax audit authorised-location src/a.ts\nCD-14#no-class-syntax audit clause-wide-carve-out *\nverdict: fail\n",
    );
  });

  it("renders the failing sections and the verdict without excluded or exempted for the failures-only output", () => {
    expect(renderReportText({ output: "failures-only", report: mixedReport })).toBe(
      "findings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nstale (2)\nCD-14#no-class-syntax audit authorised-location src/a.ts\nCD-14#no-class-syntax audit clause-wide-carve-out *\nverdict: fail\n",
    );
  });

  it("renders one count line per non-empty section, marking the informational ones, and the verdict for the counts output", () => {
    expect(renderReportText({ output: "counts", report: mixedReport })).toBe(
      "excluded (1) informational\nfindings (1)\nexempted (1) informational\nstale (2)\nverdict: fail\n",
    );
  });

  it("renders only the verdict line for the verdict-only output", () => {
    expect(renderReportText({ output: "verdict-only", report: mixedReport })).toBe("verdict: fail\n");
  });

  it("renders only the pass verdict for the failures-only output of a report whose only entries are informational", () => {
    expect(
      renderReportText({
        output: "failures-only",
        report: { ...emptyReport, excluded: [repoPathSchema.parse("generated")], exempted: [{ finding, by: [carved] }] },
      }),
    ).toBe("verdict: pass\n");
  });

  it.each(reportOutputSchema.options)("ends the %s output of a failing report with the fail verdict", (output) => {
    expect(renderReportText({ output, report: mixedReport })).toMatch(/(?:^|\n)verdict: fail\n$/);
  });

  it.each(reportOutputSchema.options)("ends the %s output of a passing report with the pass verdict", (output) => {
    expect(renderReportText({ output, report: { ...emptyReport, exempted: [{ finding, by: [carved] }] } })).toMatch(
      /(?:^|\n)verdict: pass\n$/,
    );
  });
});
const forfeitureElsewhere = (request: { readonly fileCarveOuts: number }): PartialAssessment => ({
  concern: "forfeiture",
  assessedBy: "elsewhere",
  fileCarveOuts: request.fileCarveOuts,
});

describe("renderReportText assessment", () => {
  it("renders forfeiture elsewhere with its count of file carve-outs not checked for decay, last before the verdict", () => {
    expect(
      renderReportText({
        output: "full",
        report: { ...emptyReport, exempted: [{ finding, by: [carved] }], assessment: [forfeitureElsewhere({ fileCarveOuts: 37 })] },
      }),
    ).toBe(
      "exempted (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {} exempted by file-carve-out\nassessment (1)\nforfeiture elsewhere: 37 file carve-outs not checked for decay in this run\nverdict: pass (partial assessment)\n",
    );
  });

  it("names one file carve-out in the singular", () => {
    expect(
      renderReportText({ output: "full", report: { ...emptyReport, assessment: [forfeitureElsewhere({ fileCarveOuts: 1 })] } }),
    ).toBe(
      "assessment (1)\nforfeiture elsewhere: 1 file carve-out not checked for decay in this run\nverdict: pass (partial assessment)\n",
    );
  });

  it("still renders the section when no file carve-out exists, so the choice is never invisible", () => {
    expect(
      renderReportText({ output: "full", report: { ...emptyReport, assessment: [forfeitureElsewhere({ fileCarveOuts: 0 })] } }),
    ).toBe(
      "assessment (1)\nforfeiture elsewhere: 0 file carve-outs not checked for decay in this run\nverdict: pass (partial assessment)\n",
    );
  });

  it("renders the assessment section and the marked fail verdict for a failing full report", () => {
    expect(
      renderReportText({ output: "full", report: { ...emptyReport, findings: [finding], assessment: [forfeitureElsewhere({ fileCarveOuts: 2 })] } }),
    ).toBe(
      "findings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nassessment (1)\nforfeiture elsewhere: 2 file carve-outs not checked for decay in this run\nverdict: fail (partial assessment)\n",
    );
  });
});

describe("renderReportText assessment outputs", () => {
  it("leaves the informational assessment section out of failures-only but keeps the marked verdict", () => {
    expect(
      renderReportText({
        output: "failures-only",
        report: { ...emptyReport, findings: [finding], assessment: [forfeitureElsewhere({ fileCarveOuts: 2 })] },
      }),
    ).toBe("findings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nverdict: fail (partial assessment)\n");
  });

  it("counts the assessment section as informational and marks the verdict for the counts output", () => {
    expect(
      renderReportText({
        output: "counts",
        report: { ...emptyReport, findings: [finding], assessment: [forfeitureElsewhere({ fileCarveOuts: 2 })] },
      }),
    ).toBe("findings (1)\nassessment (1) informational\nverdict: fail (partial assessment)\n");
  });

  it("marks the verdict for the verdict-only output", () => {
    expect(
      renderReportText({ output: "verdict-only", report: { ...emptyReport, assessment: [forfeitureElsewhere({ fileCarveOuts: 2 })] } }),
    ).toBe("verdict: pass (partial assessment)\n");
  });

  it.each(reportOutputSchema.options)("never prints a bare verdict for the %s output of a partial assessment", (output) => {
    expect(
      renderReportText({ output, report: { ...mixedReport, assessment: [forfeitureElsewhere({ fileCarveOuts: 2 })] } }),
    ).toMatch(/(?:^|\n)verdict: fail \(partial assessment\)\n$/);
  });

  it.each(reportOutputSchema.options)("prints the bare verdict for the %s output of a full assessment", (output) => {
    expect(renderReportText({ output, report: mixedReport })).toMatch(/(?:^|\n)verdict: fail\n$/);
  });
});

const namingConvention = clauseAddressSchema.parse("CD-6#naming-convention");

describe("renderReportText clauses not adopted", () => {
  it("lists the not-adopted clauses after the excluded paths and before the findings", () => {
    expect(
      renderReportText({
        output: "full",
        report: { ...emptyReport, excluded: [repoPathSchema.parse("generated")], notAdopted: [namingConvention], findings: [finding] },
      }),
    ).toBe(
      "excluded (1)\ngenerated\nnotAdopted (1)\nCD-6#naming-convention\nfindings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nverdict: fail\n",
    );
  });

  it("passes as a whole assessment when the report lists only not-adopted clauses", () => {
    expect(renderReportText({ output: "full", report: { ...emptyReport, notAdopted: [namingConvention] } })).toBe(
      "notAdopted (1)\nCD-6#naming-convention\nverdict: pass\n",
    );
  });

  it("counts the not-adopted clauses as informational", () => {
    expect(renderReportText({ output: "counts", report: { ...emptyReport, notAdopted: [namingConvention] } })).toBe(
      "notAdopted (1) informational\nverdict: pass\n",
    );
  });

  it("renders a clause-not-adopted invalid record with the clause's address text", () => {
    expect(
      renderReportText({
        output: "full",
        report: { ...emptyReport, invalidRecords: [{ index: 2, problem: { kind: "clause-not-adopted", clause: namingConvention } }] },
      }),
    ).toContain("\nexceptions[2] clause-not-adopted CD-6#naming-convention\n");
  });
});

describe("renderReportText clauses adopted but not run", () => {
  it("lists the not-run clauses after the not-adopted ones, each as adopted and owed to review", () => {
    expect(
      renderReportText({
        output: "full",
        report: { ...emptyReport, notAdopted: [namingConvention], notRun: [probeNoTmp], findings: [finding] },
      }),
    ).toBe(
      "notAdopted (1)\nCD-6#naming-convention\nnotRun (1)\nprobe/PD-1#no-tmp-files adopted, mechanism not run: enforced by review\nfindings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nverdict: fail\n",
    );
  });

  it("passes as a whole assessment when the report lists only not-run clauses", () => {
    expect(renderReportText({ output: "counts", report: { ...emptyReport, notRun: [probeNoTmp] } })).toBe(
      "notRun (1) informational\nverdict: pass\n",
    );
  });

  it("renders a clause-not-run invalid record with the clause's address text", () => {
    expect(
      renderReportText({
        output: "full",
        report: { ...emptyReport, invalidRecords: [{ index: 1, problem: { kind: "clause-not-run", clause: probeNoTmp } }] },
      }),
    ).toContain("\nexceptions[1] clause-not-run probe/PD-1#no-tmp-files\n");
  });
});

const loops = clauseAddressSchema.parse("CD-15#loops");

const loopsFinding: Finding = { ...finding, clause: loops, snippet: "const total = 0;" };

const readingOf = (request: {
  readonly clause: ClauseReading["clause"];
  readonly assessmentSection: ClauseReading["assessmentSection"];
  readonly presence: ClauseReading["rulePage"]["presence"];
}): ClauseReading => ({
  kind: "clause",
  clause: request.clause,
  assessmentSection: request.assessmentSection,
  rulePage: { path: `rules/${request.clause.discipline}/README.md`, presence: request.presence },
});

const pointedReport: CheckReport = {
  ...emptyReport,
  findings: [finding, loopsFinding],
  readFirst: [
    readingOf({ clause: noClass, assessmentSection: "present", presence: "present" }),
    readingOf({ clause: loops, assessmentSection: "not-assessed", presence: "present" }),
  ],
};

const unwrittenReport: CheckReport = {
  ...emptyReport,
  findings: [finding, loopsFinding],
  readFirst: [
    { kind: "assessment-file", state: "not-written", guide: "node_modules/@hailstails/hone/ADOPTING.md" },
    readingOf({ clause: noClass, assessmentSection: "unread", presence: "present" }),
    readingOf({ clause: loops, assessmentSection: "unread", presence: "present" }),
  ],
};

describe("renderReportText readFirst", () => {
  it("prints readFirst last, after the failures, so the report ends on where to read and then the verdict", () => {
    expect(renderReportText({ output: "full", report: pointedReport })).toBe(
      'findings (2)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nCD-15#loops audit src/a.ts:3:5 const total = 0;\nreadFirst (2)\nCD-14#no-class-syntax: read the "## CD-14#no-class-syntax" section of disciplines.assessment.md, then rules/CD-14/README.md#spirit\nCD-15#loops: read rules/CD-15/README.md#spirit; disciplines.assessment.md does not assess this clause\nverdict: fail\n',
    );
  });

  it("says once, first, that the assessment file is not written and where its guide is, then gives each clause its rule page", () => {
    expect(renderReportText({ output: "full", report: unwrittenReport })).toContain(
      "\nreadFirst (3)\nStart from each rule's Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.\nCD-14#no-class-syntax: read rules/CD-14/README.md#spirit\nCD-15#loops: read rules/CD-15/README.md#spirit\nverdict: fail\n",
    );
  });

  it("says once, first, that the assessment file could not be read", () => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          findings: [loopsFinding],
          readFirst: [
            { kind: "assessment-file", state: "unreadable", guide: "ADOPTING.md" },
            readingOf({ clause: loops, assessmentSection: "unread", presence: "present" }),
          ],
        },
      }),
    ).toContain(
      "\nreadFirst (2)\nStart from each rule's Spirit below. disciplines.assessment.md could not be read.\nCD-15#loops: read rules/CD-15/README.md#spirit\nverdict: fail\n",
    );
  });
});

describe("renderReportText readFirst without a rule page", () => {
  it.each([
    {
      section: "present",
      line: 'CD-15#loops: read the "## CD-15#loops" section of disciplines.assessment.md; its rule set has no rule page at rules/CD-15/README.md',
    },
    {
      section: "not-assessed",
      line: "CD-15#loops: its rule set has no rule page at rules/CD-15/README.md; disciplines.assessment.md does not assess this clause",
    },
    { section: "unread", line: "CD-15#loops: its rule set has no rule page at rules/CD-15/README.md" },
  ] as const)("says the rule set has no page when the section is $section", ({ section, line }) => {
    expect(
      renderReportText({
        output: "full",
        report: {
          ...emptyReport,
          findings: [loopsFinding],
          readFirst: [readingOf({ clause: loops, assessmentSection: section, presence: "absent" })],
        },
      }),
    ).toContain(`\nreadFirst (1)\n${line}\nverdict: fail\n`);
  });
});

describe("renderReportText readFirst by output", () => {
  it("keeps readFirst in the failures-only output, after the findings", () => {
    expect(renderReportText({ output: "failures-only", report: pointedReport })).toMatch(/^findings \(2\)\n(?:.*\n){2}readFirst \(2\)\n(?:.*\n){2}verdict: fail\n$/);
  });

  it("counts readFirst as guidance in the counts output, its note included", () => {
    expect(renderReportText({ output: "counts", report: unwrittenReport })).toBe("findings (2)\nreadFirst (3) guidance\nverdict: fail\n");
  });

  it("prints only the verdict for the verdict-only output", () => {
    expect(renderReportText({ output: "verdict-only", report: pointedReport })).toBe("verdict: fail\n");
  });
});
