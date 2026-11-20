import { describe, expect, it } from "vitest";
import { LOOP_KEYWORD_LOOPS, LOOPS_CLAUSE, SETTINGS_CATALOGUE, TEST_BODY_CLAUSE } from "../../../tests/settings-catalogue.ts";
import type { AttributedNativeException, Finding } from "../../governance/governance.ts";
import type { PlacedRecord } from "../../records/hone-record.ts";
import type { RunReport } from "../../report/run-report.ts";
import { FIRST_EDITION } from "../../values/edition.ts";
import { mechanismIdSchema } from "../../values/identifiers.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import type { CheckReport } from "../../verdict/check-report.ts";
import type { ExceptionRecord } from "../version-one-records/exception-record.ts";
import { proofDifferencesOf } from "./proof-differences.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const SRC_A = repoPathSchema.parse("src/a.ts");

const [, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY] = SETTINGS_CATALOGUE.checks;

const EMPTY_BEFORE: CheckReport = {
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

const EMPTY_AFTER: RunReport = {
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
  misnamed: [],
  paid: [],
  refused: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  notes: [],
  recordNotes: [],
  carried: [],
  symptoms: [],
};

const LOOP_FINDING: Finding = { clause: LOOPS_CLAUSE, file: SRC_A, anchor: { line: 3, column: 1 }, snippet: "the loop line", mechanism: AUDIT };

const NAMED_LOOP_FINDING: Finding = { ...LOOP_FINDING, check: "loop-keyword#loops" };

const CARVE_OUT: ExceptionRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" };

const AUTHORISED: ExceptionRecord = { kind: "authorised-location", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "kept" };

const DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/loop-keyword.json"), index: 0 },
  record: { kind: "debt", symptom: LOOP_KEYWORD_LOOPS.symptom, reach: { reaches: "one-check", check: LOOP_KEYWORD_LOOPS }, file: SRC_A, holding: { held: "stated" } },
};

const AUTHORISED_LOCATION: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/authorised-locations/loop-keyword.json"), index: 0 },
  record: {
    kind: "authorised-location",
    symptom: LOOP_KEYWORD_LOOPS.symptom,
    reach: { reaches: "one-check", check: LOOP_KEYWORD_LOOPS },
    file: SRC_A,
    holding: { held: "carried", entry: {}, lacks: [], standing: "established" },
  },
};

const INLINE_DISABLE: AttributedNativeException = {
  kind: "inline-disable",
  clause: LOOPS_CLAUSE,
  file: SRC_A,
  line: 3,
  text: "eslint-disable-next-line",
  reach: "one-clause",
  mechanism: AUDIT,
};

const differencesBetween = (request: { readonly before?: Partial<CheckReport>; readonly after?: Partial<RunReport> }) =>
  proofDifferencesOf({ before: { ...EMPTY_BEFORE, ...request.before }, after: { ...EMPTY_AFTER, ...request.after }, catalogue: SETTINGS_CATALOGUE });

describe("proofDifferencesOf", () => {
  it("finds no difference between two reports that hold nothing", () => {
    expect(differencesBetween({})).toEqual([]);
  });

  it("finds no difference for a finding both sides report, version 2's named check read as its clause", () => {
    expect(differencesBetween({ before: { findings: [LOOP_FINDING] }, after: { findings: [NAMED_LOOP_FINDING] } })).toEqual([]);
  });

  it("names a finding only version 2 reports, with the verdict that follows", () => {
    expect(differencesBetween({ after: { findings: [NAMED_LOOP_FINDING] } })).toEqual([
      { section: "findings", onlyBefore: [], onlyAfter: ["CD-15#loops src/a.ts 3:1"] },
      { section: "verdict", onlyBefore: ["pass"], onlyAfter: ["fail"] },
    ]);
  });

  it("reads version 2's finding at the clause of the check it names, so a wrong attribution is a difference", () => {
    const misattributed: Finding = { ...LOOP_FINDING, check: "rebinding#test-body" };
    expect(differencesBetween({ before: { findings: [LOOP_FINDING] }, after: { findings: [misattributed] } })).toEqual([
      { section: "findings", onlyBefore: ["CD-15#loops src/a.ts 3:1"], onlyAfter: ["CD-27#test-body-logic src/a.ts 3:1"] },
    ]);
  });

  it("counts a finding as many times as a side reports it", () => {
    expect(differencesBetween({ before: { findings: [LOOP_FINDING, LOOP_FINDING] }, after: { findings: [NAMED_LOOP_FINDING] } })).toEqual([
      { section: "findings", onlyBefore: ["CD-15#loops src/a.ts 3:1"], onlyAfter: [] },
    ]);
  });

  it("finds no difference when a file carve-out answered a finding and a debt answers it now", () => {
    expect(differencesBetween({ before: { exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }] }, after: { answered: [{ finding: NAMED_LOOP_FINDING, by: [DEBT] }] } })).toEqual([]);
  });

  it("finds no difference when an authorised location answered a finding and one answers it now", () => {
    expect(
      differencesBetween({ before: { exempted: [{ finding: LOOP_FINDING, by: [AUTHORISED] }] }, after: { answered: [{ finding: NAMED_LOOP_FINDING, by: [AUTHORISED_LOCATION] }] } }),
    ).toEqual([]);
  });

  it("names a finding answered by another kind of record than before", () => {
    expect(differencesBetween({ before: { exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }] }, after: { answered: [{ finding: NAMED_LOOP_FINDING, by: [AUTHORISED_LOCATION] }] } })).toEqual([
      {
        section: "answered",
        onlyBefore: ["CD-15#loops src/a.ts 3:1 answered by debt"],
        onlyAfter: ["CD-15#loops src/a.ts 3:1 answered by authorised-location"],
      },
    ]);
  });

  it("names a finding answered before that version 2 leaves unanswered, in both sections and the verdict", () => {
    expect(differencesBetween({ before: { exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }] }, after: { findings: [NAMED_LOOP_FINDING] } })).toEqual([
      { section: "findings", onlyBefore: [], onlyAfter: ["CD-15#loops src/a.ts 3:1"] },
      { section: "answered", onlyBefore: ["CD-15#loops src/a.ts 3:1 answered by debt"], onlyAfter: [] },
      { section: "verdict", onlyBefore: ["pass"], onlyAfter: ["fail"] },
    ]);
  });

  it("names a native exception only one side reports as unrecorded", () => {
    expect(differencesBetween({ before: { unrecorded: [INLINE_DISABLE] } })).toEqual([
      { section: "unrecorded", onlyBefore: ["audit inline-disable CD-15#loops src/a.ts:3"], onlyAfter: [] },
      { section: "verdict", onlyBefore: ["fail"], onlyAfter: ["pass"] },
    ]);
  });

  it("names a clause uncovered on one side", () => {
    expect(differencesBetween({ before: { uncovered: [TEST_BODY_CLAUSE] }, after: { uncovered: [] } })).toEqual([
      { section: "uncovered", onlyBefore: ["CD-27#test-body-logic"], onlyAfter: [] },
      { section: "verdict", onlyBefore: ["fail"], onlyAfter: ["pass"] },
    ]);
  });

  it("reads each uncovered check as its clause, once", () => {
    expect(differencesBetween({ before: { uncovered: [TEST_BODY_CLAUSE] }, after: { uncovered: [LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY] } })).toEqual([]);
  });

  it("names a clause that is stale on a side, by its file", () => {
    expect(differencesBetween({ before: { stale: [CARVE_OUT] } })).toEqual([
      { section: "stale", onlyBefore: ["src/a.ts"], onlyAfter: [] },
      { section: "verdict", onlyBefore: ["fail"], onlyAfter: ["pass"] },
    ]);
  });

  it("names a pair version 1 holds doubly, which version 2 has no section for", () => {
    expect(differencesBetween({ before: { doublyHeld: [{ clause: LOOPS_CLAUSE, file: SRC_A, mechanism: AUDIT }] } })).toEqual([
      { section: "doublyHeld", onlyBefore: ["CD-15#loops src/a.ts audit"], onlyAfter: [] },
      { section: "verdict", onlyBefore: ["fail"], onlyAfter: ["pass"] },
    ]);
  });

  it("names a record version 1 held invalid against one version 2 refuses, by place", () => {
    expect(
      differencesBetween({
        before: { invalidRecords: [{ place: { layout: "single-file", file: SRC_A, index: 1 }, problem: { kind: "clause-unparseable", detail: "x" } }] },
        after: { refused: [{ place: { file: repoPathSchema.parse("hone-records/debt/loop-keyword.json"), index: 0 }, refusals: [{ kind: "unknown-symptom", symptom: "x" }] }] },
      }),
    ).toEqual([{ section: "invalidRecords", onlyBefore: ["src/a.ts 1"], onlyAfter: ["hone-records/debt/loop-keyword.json 0"] }]);
  });

  it("reads each side's editions at the clause its checks serve", () => {
    expect(
      differencesBetween({
        before: { editions: [{ address: LOOPS_CLAUSE, mechanism: AUDIT, edition: FIRST_EDITION, latest: FIRST_EDITION }] },
        after: { editions: [{ check: LOOP_KEYWORD_LOOPS, engine: { name: "walker", mechanism: AUDIT }, edition: FIRST_EDITION, latest: FIRST_EDITION }] },
      }),
    ).toEqual([]);
  });

  it("names an engine not run on one side", () => {
    expect(differencesBetween({ before: { unmeasured: [{ kind: "mechanism-not-run", mechanism: AUDIT, projection: "missing" }] } })).toEqual([
      { section: "unmeasured", onlyBefore: ["audit not-run missing"], onlyAfter: [] },
      { section: "verdict", onlyBefore: ["fail"], onlyAfter: ["pass"] },
    ]);
  });
});
