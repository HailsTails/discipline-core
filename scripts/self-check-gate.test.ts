import { describe, expect, it } from "vitest";
import type { Finding } from "../core/governance/governance.ts";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { mechanismIdSchema } from "../core/values/identifiers.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import type { CheckReport } from "../core/verdict/check-report.ts";
import { selfCheckOutcomeOf } from "./self-check-gate.ts";

const EMPTY_REPORT: CheckReport = {
  excluded: [],
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
};

const CLASS_IN_A: Finding = {
  clause: clauseAddressSchema.parse("CD-14#class-syntax"),
  file: repoPathSchema.parse("src/a.ts"),
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
  mechanism: mechanismIdSchema.parse("audit"),
};

describe("selfCheckOutcomeOf", () => {
  it("passes a clean run, printing the report and the gate line", () => {
    expect(selfCheckOutcomeOf({ result: { outcome: "ok", value: { report: EMPTY_REPORT, output: "full" } } })).toEqual({
      code: 0,
      text: "verdict: pass\nself-check: pass, the selection, records and projection are sound; findings (0) and unrecorded (0) are reported above and not gated\n",
    });
  });

  it("passes a run whose only failures are findings, printing them in full as not gated", () => {
    expect(
      selfCheckOutcomeOf({ result: { outcome: "ok", value: { report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] }, output: "full" } } }),
    ).toEqual({
      code: 0,
      text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nverdict: fail\nself-check: pass, the selection, records and projection are sound; findings (1) and unrecorded (0) are reported above and not gated\n",
    });
  });

  it("fails naming each gated section that holds an entry", () => {
    expect(
      selfCheckOutcomeOf({
        result: {
          outcome: "ok",
          value: {
            report: {
              ...EMPTY_REPORT,
              findings: [CLASS_IN_A],
              uncovered: [clauseAddressSchema.parse("CD-15#loops")],
              unmeasured: [{ kind: "import-unmeasured" }],
            },
            output: "counts",
          },
        },
      }),
    ).toEqual({
      code: 1,
      text: "findings (1)\nuncovered (1)\nunmeasured (1)\nverdict: fail\nself-check: fail, gated sections hold entries: uncovered (1), unmeasured (1)\n",
    });
  });

  it("exits 2 with the load failure when the check cannot load", () => {
    expect(selfCheckOutcomeOf({ result: { outcome: "failed", error: { kind: "arguments-invalid", detail: "--repo is required" } } })).toEqual({
      code: 2,
      text: "load failure: arguments-invalid --repo is required\n",
    });
  });
});