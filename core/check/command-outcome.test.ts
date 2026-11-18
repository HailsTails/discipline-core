import { describe, expect, it } from "vitest";
import type { Finding } from "../governance/governance.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { reportOutputSchema } from "../values/report-output.ts";
import type { CheckReport } from "../verdict/check-report.ts";
import {
  checkCommandOutcome,
  inheritedDebtLine,
  projectCommandOutcome,
  splitRecordsCommandOutcome,
  versionCommandOutcome,
} from "./command-outcome.ts";

const PROJECT_COMMAND = "node core/check/tool-command.ts project --repo .";

const WALKER = mechanismIdSchema.parse("audit");

const EMPTY_REPORT: CheckReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
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

const CLASS_IN_A: Finding = {
  clause: clauseAddressSchema.parse("CD-14#class-syntax"),
  file: repoPathSchema.parse("src/a.ts"),
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
  mechanism: WALKER,
};

describe("checkCommandOutcome", () => {
  it("exits 0 and prints the report when the verdict is pass", () => {
    expect(checkCommandOutcome({ result: { outcome: "ok", value: { report: EMPTY_REPORT, output: "full", projectCommand: PROJECT_COMMAND } } })).toEqual({
      code: 0,
      text: "verdict: pass\n",
    });
  });

  it("exits 1 and prints the report when the verdict is fail", () => {
    expect(checkCommandOutcome({ result: { outcome: "ok", value: { report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] }, output: "full", projectCommand: PROJECT_COMMAND } } })).toEqual({
      code: 1,
      text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nverdict: fail\n",
    });
  });

  it("exits 1 when the only entry is forfeiture-unmeasured", () => {
    expect(
      checkCommandOutcome({
        result: {
          outcome: "ok",
          value: { report: { ...EMPTY_REPORT, unmeasured: [{ kind: "forfeiture-unmeasured", base: { state: "not-given" } }] }, output: "full", projectCommand: PROJECT_COMMAND },
        },
      }),
    ).toEqual({
      code: 1,
      text: "unmeasured (1)\nforfeiture-unmeasured no-base-revision: no --base-revision was given, so file carve-outs cannot be checked for decay; pass --base-revision with the branch's base, such as origin/main, or leave decay to another run with \"assessment\": { \"forfeiture\": \"elsewhere\" } in disciplines.json or --forfeiture elsewhere\nverdict: fail\n",
    });
  });

  it.each(reportOutputSchema.options)("exits 1 for a failing report whatever the %s output prints", (output) => {
    expect(
      checkCommandOutcome({ result: { outcome: "ok", value: { report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] }, output, projectCommand: PROJECT_COMMAND } } })
        .code,
    ).toBe(1);
  });

  it.each(reportOutputSchema.options)("exits 0 for a passing report whatever the %s output prints", (output) => {
    expect(
      checkCommandOutcome({
        result: { outcome: "ok", value: { report: { ...EMPTY_REPORT, excluded: [repoPathSchema.parse("generated")] }, output, projectCommand: PROJECT_COMMAND } },
      }).code,
    ).toBe(0);
  });

  it("exits 1 printing only the failing sections and the verdict for the failures-only output", () => {
    expect(
      checkCommandOutcome({
        result: {
          outcome: "ok",
          value: {
            report: { ...EMPTY_REPORT, excluded: [repoPathSchema.parse("generated")], findings: [CLASS_IN_A] },
            output: "failures-only", projectCommand: PROJECT_COMMAND,
          },
        },
      }),
    ).toEqual({ code: 1, text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nverdict: fail\n" });
  });

  it("exits 1 printing only the verdict for the verdict-only output", () => {
    expect(
      checkCommandOutcome({
        result: { outcome: "ok", value: { report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] }, output: "verdict-only", projectCommand: PROJECT_COMMAND } },
      }),
    ).toEqual({ code: 1, text: "verdict: fail\n" });
  });

  it("exits 2 and prints the load failure line when an input could not be loaded", () => {
    expect(
      checkCommandOutcome({
        result: { outcome: "failed", error: { kind: "file-malformed", path: "/repo/disciplines.json", detail: "Unexpected end" } },
      }),
    ).toEqual({ code: 2, text: "load failure: file-malformed /repo/disciplines.json Unexpected end\n" });
  });

  it("exits 2 and prints the load failure line when the arguments are invalid", () => {
    expect(
      checkCommandOutcome({ result: { outcome: "failed", error: { kind: "arguments-invalid", detail: "--repo is required" } } }),
    ).toEqual({ code: 2, text: "load failure: arguments-invalid --repo is required\n" });
  });

  it("exits 2 and names the runner failure when a runner failed", () => {
    expect(
      checkCommandOutcome({
        result: {
          outcome: "failed",
          error: { kind: "runner-failed", mechanism: WALKER, failure: { kind: "runner-invalid-output", detail: "run rejected" } },
        },
      }),
    ).toEqual({ code: 2, text: "load failure: runner-failed audit runner-invalid-output run rejected\n" });
  });
});

describe("projectCommandOutcome", () => {
  it("exits 0 and prints nothing when there are no projection writes", () => {
    expect(projectCommandOutcome({ result: { outcome: "ok", value: [] } })).toEqual({ code: 0, text: "" });
  });

  it("exits 0 and prints one <path> <effect> line per projection write", () => {
    expect(
      projectCommandOutcome({
        result: {
          outcome: "ok",
          value: [
            { path: repoPathSchema.parse("eslint.discipline.config.mjs"), effect: "written" },
            { path: repoPathSchema.parse("config/eslint.discipline.mjs"), effect: "unchanged" },
          ],
        },
      }),
    ).toEqual({ code: 0, text: "eslint.discipline.config.mjs written\nconfig/eslint.discipline.mjs unchanged\n" });
  });

  it("exits 2 and prints the load failure line on a failure", () => {
    expect(
      projectCommandOutcome({ result: { outcome: "failed", error: { kind: "runner-missing", mechanism: WALKER } } }),
    ).toEqual({ code: 2, text: "load failure: runner-missing audit\n" });
  });
});

describe("versionCommandOutcome", () => {
  it("exits 0 printing the version on its own line", () => {
    expect(versionCommandOutcome({ result: { outcome: "ok", value: "1.0.0" } })).toEqual({ code: 0, text: "1.0.0\n" });
  });

  it("exits 2 printing the load failure line when the version cannot be read", () => {
    expect(
      versionCommandOutcome({ result: { outcome: "failed", error: { kind: "file-unreadable", path: "package.json", detail: "EACCES" } } }),
    ).toEqual({ code: 2, text: "load failure: file-unreadable package.json EACCES\n" });
  });
});

describe("splitRecordsCommandOutcome", () => {
  it("prints each file written, then the file removed, and exits 0", () => {
    expect(
      splitRecordsCommandOutcome({
        result: {
          outcome: "ok",
          value: {
            effect: "split",
            writes: [
              { path: repoPathSchema.parse("discipline-exceptions/file-carve-outs/cd-19.json"), effect: "written" },
              { path: repoPathSchema.parse("discipline-exceptions.json"), effect: "removed" },
            ],
          },
        },
      }),
    ).toEqual({ code: 0, text: "discipline-exceptions/file-carve-outs/cd-19.json written\ndiscipline-exceptions.json removed\n" });
  });

  it.each([
    {
      split: { effect: "already-split", path: repoPathSchema.parse("discipline-exceptions") },
      text: "discipline-exceptions already holds the records split: nothing to split\n",
    },
    {
      split: { effect: "no-records", path: repoPathSchema.parse("discipline-exceptions.json") },
      text: "discipline-exceptions.json holds no records: nothing to split\n",
    },
  ] as const)("prints one line and exits 0 when there is nothing to split: $text", ({ split, text }) => {
    expect(splitRecordsCommandOutcome({ result: { outcome: "ok", value: split } })).toEqual({ code: 0, text });
  });

  it("prints the load failure and exits 2 when the records cannot be split", () => {
    expect(
      splitRecordsCommandOutcome({ result: { outcome: "failed", error: { kind: "records-unsplittable", path: "discipline-exceptions.json", detail: "exceptions[1] names no discipline" } } }),
    ).toEqual({ code: 2, text: "load failure: records-unsplittable discipline-exceptions.json exceptions[1] names no discipline\n" });
  });
});

describe("inheritedDebtLine", () => {
  it("names the file that already holds the record", () => {
    expect(
      inheritedDebtLine({
        outcome: {
          clause: clauseAddressSchema.parse("CD-15#loops"),
          file: repoPathSchema.parse("src/basket.ts"),
          effect: "already-recorded",
          heldIn: repoPathSchema.parse("discipline-exceptions/authorised-locations/cd-15.json"),
        },
      }),
    ).toBe(
      "CD-15#loops already-recorded src/basket.ts: discipline-exceptions/authorised-locations/cd-15.json already holds a record on this clause and file; the check says why it does not hold\n",
    );
  });

  it("names the folder whose configuration the file loads apart from the folder holding the disciplines.json a person would remove", () => {
    expect(
      inheritedDebtLine({
        outcome: {
          clause: clauseAddressSchema.parse("CD-15#loops"),
          file: repoPathSchema.parse("nested/src/n.ts"),
          effect: "nested-configuration",
          under: repoPathSchema.parse("nested/src"),
          selectionFolder: repoPathSchema.parse("nested"),
          mechanism: mechanismIdSchema.parse("eslint"),
        },
      }),
    ).toBe(
      "CD-15#loops nested-configuration nested/src/n.ts: the file loads the eslint configuration in nested/src, and nested holds its own disciplines.json; nested Hone configurations are not supported yet (https://github.com/HailsTails/hone/issues/72), so the eslint projection cannot put a record on this file into effect; fix it, or govern nested from this repository by removing nested/disciplines.json, then run record-debt again\n",
    );
  });
});
