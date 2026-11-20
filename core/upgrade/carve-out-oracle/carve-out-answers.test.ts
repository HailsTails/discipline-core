import { describe, expect, it } from "vitest";
import { LOOPS_CLAUSE, SETTINGS_CATALOGUE, TEST_BODY_CLAUSE } from "../../../tests/settings-catalogue.ts";
import type { Finding } from "../../governance/governance.ts";
import { mechanismIdSchema } from "../../values/identifiers.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import type { GovernanceResult } from "../answering/governance.ts";
import type { ExceptionRecord } from "../version-one-records/exception-record.ts";
import { carveOutAnswersOf } from "./carve-out-answers.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const SRC_A = repoPathSchema.parse("src/a.ts");

const [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY] = SETTINGS_CATALOGUE.checks;

const CARVE_OUT: ExceptionRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" };

const AUTHORISED: ExceptionRecord = { kind: "authorised-location", clause: TEST_BODY_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "kept" };

const LOOP_FINDING: Finding = {
  clause: LOOPS_CLAUSE,
  file: SRC_A,
  anchor: { line: 3, column: 1 },
  snippet: "the loop line",
  mechanism: AUDIT,
  check: "loop-keyword#loops",
};

const NOTHING_GOVERNED: GovernanceResult = { findings: [], exempted: [], stale: [], forfeited: [], doublyHeld: [], unrecorded: [] };

const catalogue = { checks: SETTINGS_CATALOGUE.checks };

describe("carveOutAnswersOf crediting a file carve-out with the findings it exempted", () => {
  it("credits the check a finding names", () => {
    expect(
      carveOutAnswersOf({
        records: [CARVE_OUT],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }] },
        catalogue,
      }),
    ).toEqual({ outcome: "ok", value: [{ record: CARVE_OUT, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } }] });
  });

  it("credits each check of the findings a carve-out exempted, in the order the findings came", () => {
    const carveOut: ExceptionRecord = { ...CARVE_OUT, clause: TEST_BODY_CLAUSE };
    const forLoop: Finding = { ...LOOP_FINDING, clause: TEST_BODY_CLAUSE, check: "loop-keyword#test-body" };
    const rebinding: Finding = { ...LOOP_FINDING, clause: TEST_BODY_CLAUSE, check: "rebinding#test-body" };
    expect(
      carveOutAnswersOf({
        records: [carveOut],
        governed: {
          ...NOTHING_GOVERNED,
          exempted: [
            { finding: forLoop, by: [carveOut] },
            { finding: rebinding, by: [carveOut] },
          ],
        },
        catalogue,
      }),
    ).toEqual({ outcome: "ok", value: [{ record: carveOut, answer: { credit: "findings", checks: [LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY] } }] });
  });

  it("credits the one check of the clause run by the finding's mechanism when the finding names none", () => {
    expect(
      carveOutAnswersOf({
        records: [CARVE_OUT],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: { ...LOOP_FINDING, mechanism: ESLINT, check: undefined }, by: [CARVE_OUT] }] },
        catalogue,
      }),
    ).toEqual({ outcome: "ok", value: [{ record: CARVE_OUT, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } }] });
  });

  it("fails when a finding names no check and its mechanism runs two checks of the clause", () => {
    const carveOut: ExceptionRecord = { ...CARVE_OUT, clause: TEST_BODY_CLAUSE };
    expect(
      carveOutAnswersOf({
        records: [carveOut],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: { ...LOOP_FINDING, clause: TEST_BODY_CLAUSE, check: undefined }, by: [carveOut] }] },
        catalogue,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "finding-not-attributable", clause: "CD-27#test-body-logic", file: "src/a.ts", check: undefined } });
  });

  it("fails when a finding names a check the clause does not hold", () => {
    expect(
      carveOutAnswersOf({
        records: [CARVE_OUT],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: { ...LOOP_FINDING, check: "rebinding#test-body" }, by: [CARVE_OUT] }] },
        catalogue,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "finding-not-attributable", clause: "CD-15#loops", file: "src/a.ts", check: "rebinding#test-body" } });
  });
});

describe("carveOutAnswersOf answering a file carve-out that exempted no finding", () => {
  it("answers nothing for a carve-out the governance found stale", () => {
    expect(carveOutAnswersOf({ records: [CARVE_OUT], governed: { ...NOTHING_GOVERNED, stale: [CARVE_OUT] }, catalogue })).toEqual({
      outcome: "ok",
      value: [{ record: CARVE_OUT, answer: { credit: "nothing" } }],
    });
  });

  it("answers suppression-only for a carve-out that is neither stale nor credited a finding, held up by a native suppression alone", () => {
    expect(carveOutAnswersOf({ records: [CARVE_OUT], governed: NOTHING_GOVERNED, catalogue })).toEqual({
      outcome: "ok",
      value: [{ record: CARVE_OUT, answer: { credit: "suppression-only" } }],
    });
  });

  it("fails for a carve-out on a clause and file an authorised location also holds", () => {
    expect(
      carveOutAnswersOf({
        records: [CARVE_OUT],
        governed: { ...NOTHING_GOVERNED, doublyHeld: [{ clause: LOOPS_CLAUSE, file: SRC_A, mechanism: AUDIT }] },
        catalogue,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "record-doubly-held", clause: "CD-15#loops", file: "src/a.ts" } });
  });
});

describe("carveOutAnswersOf over every record of the file", () => {
  it("answers only the file carve-outs, in the order the records were given", () => {
    const second: ExceptionRecord = { ...CARVE_OUT, file: repoPathSchema.parse("src/b.ts") };
    expect(
      carveOutAnswersOf({ records: [AUTHORISED, CARVE_OUT, second], governed: { ...NOTHING_GOVERNED, stale: [CARVE_OUT, second] }, catalogue }),
    ).toEqual({
      outcome: "ok",
      value: [
        { record: CARVE_OUT, answer: { credit: "nothing" } },
        { record: second, answer: { credit: "nothing" } },
      ],
    });
  });
});
