import { describe, expect, it } from "vitest";
import { CAST_CHECK, CAST_EXPRESSIONS, CLAIMED_TYPE, CLOCK_CHECK, CLOCK_SOURCES, ESLINT, ESLINT_ENGINE, REPORT_CATALOGUE, TEST_BODY_CHECK, TEST_BODY_LOGIC, WHOLE_SYMPTOM } from "../../tests/report-catalogue.ts";
import type { MisnamedRuleId } from "../mechanism-port/checks-runner-types.ts";
import type { Hit } from "../mechanism-port/runner-result-schema.ts";
import type { Debt, PlacedRecord, RecordsReading, RefusedRecord } from "../records/hone-record.ts";
import type { RunReport } from "../report/run-report.ts";
import type { TouchedSet } from "../touched-set/touched-set.ts";
import { editionSchema } from "../values/edition.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { EngineRun } from "./engine-run.ts";
import { type RunReportRequest, runReportOf } from "./run-report-of.ts";

const FILE_A = repoPathSchema.parse("src/a.ts");

const FILE_B = repoPathSchema.parse("src/b.ts");

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/claimed-type.json");

const CAST_HIT: Hit = { clause: CAST_EXPRESSIONS, file: FILE_A, anchor: { line: 4, column: 9 }, snippet: "body as Event", check: "claimed-type#cast-expressions" };

const CAST_FINDING = { ...CAST_HIT, mechanism: ESLINT };

const eslintRunOf = (request: { readonly hits: readonly Hit[]; readonly projection: EngineRun["projection"] }): EngineRun => ({
  mechanism: ESLINT,
  hits: request.hits,
  nativeExceptions: [],
  coverableKinds: ["config-override", "inline-disable"],
  projection: request.projection,
  slices: [],
  unprojectedFolders: [],
  measured: [],
  misnamedRuleIds: [],
});

const debtAt = (request: { readonly file: Debt["file"]; readonly index: number }): PlacedRecord => ({
  place: { file: DEBT_FILE, index: request.index },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: request.file, holding: { held: "stated" } },
});

const NO_RECORDS: RecordsReading = { records: [], refused: [], notes: [], base: { measured: "yes" } };

const MEASURED_NOTHING_TOUCHED: TouchedSet = { measured: "yes", paths: new Set() };

const REQUEST: RunReportRequest = {
  catalogue: REPORT_CATALOGUE,
  selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
  excluded: [],
  notes: [],
  records: NO_RECORDS,
  touched: MEASURED_NOTHING_TOUCHED,
  runs: [],
  assessment: { forfeiture: "this-run" },
};

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

describe("runReportOf, findings and records", () => {
  it("reports a finding no record answers, naming its mechanism, with the note of its symptom", () => {
    expect(runReportOf({ ...REQUEST, runs: [eslintRunOf({ hits: [CAST_HIT], projection: "current" })] })).toEqual({
      ...EMPTY_REPORT,
      findings: [CAST_FINDING],
      symptoms: [CLAIMED_TYPE],
    });
  });

  it("reports a finding a record answers as answered, and the record as not stale", () => {
    const debt = debtAt({ file: FILE_A, index: 0 });
    expect(runReportOf({ ...REQUEST, records: { ...NO_RECORDS, records: [debt] }, runs: [eslintRunOf({ hits: [CAST_HIT], projection: "current" })] })).toEqual({
      ...EMPTY_REPORT,
      answered: [{ finding: CAST_FINDING, by: [debt] }],
    });
  });

  it("reports a record that answers nothing as stale", () => {
    const debt = debtAt({ file: FILE_B, index: 0 });
    expect(runReportOf({ ...REQUEST, records: { ...NO_RECORDS, records: [debt] }, runs: [eslintRunOf({ hits: [CAST_HIT], projection: "current" })] })).toEqual({
      ...EMPTY_REPORT,
      findings: [CAST_FINDING],
      stale: [debt],
      symptoms: [CLAIMED_TYPE],
    });
  });

  it("reports debt on a file the change touched as forfeited, and the finding it held as unanswered", () => {
    const debt = debtAt({ file: FILE_A, index: 0 });
    expect(
      runReportOf({
        ...REQUEST,
        touched: { measured: "yes", paths: new Set([FILE_A]) },
        records: { ...NO_RECORDS, records: [debt] },
        runs: [eslintRunOf({ hits: [CAST_HIT], projection: "current" })],
      }),
    ).toEqual({ ...EMPTY_REPORT, findings: [CAST_FINDING], forfeited: [debt], symptoms: [CLAIMED_TYPE] });
  });

  it("carries what the records reading found: refused records, notes and the records carried from version 1", () => {
    const carried: PlacedRecord = {
      place: { file: DEBT_FILE, index: 3 },
      record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: FILE_B, holding: { held: "carried", entry: {}, lacks: [], standing: "established" } },
    };
    const refused: RefusedRecord = { place: { file: DEBT_FILE, index: 1 }, refusals: [{ kind: "carried-changed-since-base" }] };
    expect(runReportOf({ ...REQUEST, records: { records: [carried], refused: [refused], notes: [], base: { measured: "yes" } } })).toMatchObject({
      refused: [refused],
      carried: [{ place: { file: DEBT_FILE, index: 3 }, lacks: [], standing: "established" }],
    });
  });
});

describe("runReportOf, what the run could not measure", () => {
  it("lists debt unmeasured for forfeiture when no base revision was given, beside an engine whose projection is not written", () => {
    expect(
      runReportOf({
        ...REQUEST,
        touched: { measured: "no", base: { state: "not-given" } },
        records: { ...NO_RECORDS, records: [debtAt({ file: FILE_B, index: 0 })] },
        runs: [eslintRunOf({ hits: [], projection: "missing" })],
      }),
    ).toMatchObject({
      unmeasured: [
        { kind: "forfeiture-unmeasured", base: { state: "not-given" } },
        { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "missing" },
      ],
    });
  });

  it("lists a projection that differs from what project writes now as a projection problem", () => {
    expect(runReportOf({ ...REQUEST, runs: [eslintRunOf({ hits: [], projection: "out-of-date" })] })).toMatchObject({
      projectionProblems: [{ scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" }],
    });
  });

  it("counts the debt records not checked for forfeiture when forfeiture is left elsewhere", () => {
    expect(
      runReportOf({
        ...REQUEST,
        assessment: { forfeiture: "elsewhere" },
        touched: { measured: "elsewhere" },
        records: { ...NO_RECORDS, records: [debtAt({ file: FILE_A, index: 0 }), debtAt({ file: FILE_B, index: 1 })] },
      }),
    ).toMatchObject({ assessment: [{ concern: "forfeiture", assessedBy: "elsewhere", debts: 2 }] });
  });
});

describe("runReportOf, the selection and the settings", () => {
  it("lists the checks of the clauses marked not-adopted, not-run or left unlisted, the editions ran, the excluded paths and the settings notes", () => {
    expect(
      runReportOf({
        ...REQUEST,
        selection: {
          selected: [],
          uncovered: [CLOCK_SOURCES],
          notAdopted: [CAST_EXPRESSIONS],
          notRun: [TEST_BODY_LOGIC],
          editions: [{ address: CAST_EXPRESSIONS, mechanism: ESLINT, edition: editionSchema.parse("1"), latest: editionSchema.parse("2") }],
        },
        excluded: [repoPathSchema.parse("dist")],
        notes: [{ kind: "declared-not-read", key: "layers" }],
      }),
    ).toEqual({
      ...EMPTY_REPORT,
      excluded: ["dist"],
      notAdopted: [CAST_CHECK],
      notRun: [TEST_BODY_CHECK],
      editions: [{ check: CAST_CHECK, engine: ESLINT_ENGINE, edition: "1", latest: "2" }],
      uncovered: [CLOCK_CHECK],
      notes: [{ kind: "declared-not-read", key: "layers" }],
    });
  });

  it("reports each misnamed rule id the runs found", () => {
    const misnamed: MisnamedRuleId = { kind: "version-1-id", ruleId: "hone/no-class-authoring", file: FILE_A, line: 2, text: "// eslint-disable-next-line hone/no-class-authoring" };
    expect(runReportOf({ ...REQUEST, runs: [{ ...eslintRunOf({ hits: [], projection: "current" }), misnamedRuleIds: [misnamed] }] })).toMatchObject({ misnamed: [misnamed] });
  });
});
