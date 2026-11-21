import { describe, expect, it } from "vitest";
import type { Check, Symptom } from "../symptom-catalogue/symptom-catalogue.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { engineMeasurementOf, measurementOf, type RunMeasurement, type RunMeasurements } from "./measured-at.ts";
import type { ReachedPlace } from "./record-reach.ts";

const WALKER = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const SYMPTOM: Symptom = { name: "claimed-type", title: "Claimed type", seen: "Seen.", mayIndicate: [], breachUsuallySits: "in the unit", recipes: [], correctUses: [] };

const CLAUSE = clauseAddressSchema.parse("CD-2#cast-expressions");

const OTHER_CLAUSE = clauseAddressSchema.parse("CD-2#non-null-assertions");

const FILE_A = repoPathSchema.parse("src/a.ts");

const FILE_B = repoPathSchema.parse("src/b.ts");

const CHECK: Check = { name: "cast-expressions", symptom: SYMPTOM, clause: CLAUSE, engines: [{ name: "eslint", mechanism: ESLINT }], forms: [] };

const AT_FILE_A: ReachedPlace = { check: CHECK, place: { at: "file", file: FILE_A } };

const AT_SRC: ReachedPlace = { check: CHECK, place: { at: "module", module: repoPathSchema.parse("src") } };

const TRACKED = [FILE_A, FILE_B];

const measurementsOf = (request: { readonly runs: readonly RunMeasurement[] }): RunMeasurements => ({ runs: request.runs, tracked: TRACKED });

const eslintRun = (request: Pick<RunMeasurement, "selected" | "measured">): RunMeasurement => ({ mechanism: ESLINT, ...request });

describe("measurementOf", () => {
  it("says measured when a run of an engine of the check selected its clause and reported it measured at the file", () => {
    expect(measurementOf({ measurements: measurementsOf({ runs: [eslintRun({ selected: [CLAUSE], measured: [{ clause: CLAUSE, file: FILE_A }] })] }), reached: AT_FILE_A })).toBe("measured");
  });

  it("says measured for a module place when the run measured a file under the module", () => {
    expect(measurementOf({ measurements: measurementsOf({ runs: [eslintRun({ selected: [CLAUSE], measured: [{ clause: CLAUSE, file: FILE_B }] })] }), reached: AT_SRC })).toBe("measured");
  });

  it("says not-measured when the run selected the clause and measured it at other files only", () => {
    expect(measurementOf({ measurements: measurementsOf({ runs: [eslintRun({ selected: [CLAUSE], measured: [{ clause: CLAUSE, file: FILE_B }] })] }), reached: AT_FILE_A })).toBe("not-measured");
  });

  it("says not-measured when the run measured the file for another clause only", () => {
    expect(measurementOf({ measurements: measurementsOf({ runs: [eslintRun({ selected: [CLAUSE], measured: [{ clause: OTHER_CLAUSE, file: FILE_A }] })] }), reached: AT_FILE_A })).toBe("not-measured");
  });

  it("says not-run when no run of an engine of the check selected its clause", () => {
    expect(measurementOf({ measurements: measurementsOf({ runs: [eslintRun({ selected: [OTHER_CLAUSE], measured: [] }), { mechanism: WALKER, selected: [CLAUSE], measured: [] }] }), reached: AT_FILE_A })).toBe("not-run");
  });

  it("says gone when the run selected the clause and the place is no longer in the tree", () => {
    const measurements: RunMeasurements = { runs: [eslintRun({ selected: [CLAUSE], measured: [] })], tracked: [FILE_B] };
    expect(measurementOf({ measurements, reached: AT_FILE_A })).toBe("gone");
  });

  it("says not-run when there are no runs", () => {
    expect(measurementOf({ measurements: measurementsOf({ runs: [] }), reached: AT_FILE_A })).toBe("not-run");
  });
});

describe("engineMeasurementOf", () => {
  it("says measured-nothing for a run with selected clauses that reported no measured pair", () => {
    expect(engineMeasurementOf({ run: eslintRun({ selected: [CLAUSE], measured: [] }), inReach: TRACKED })).toBe("measured-nothing");
  });

  it("says measured-something for a run that reported a measured pair", () => {
    expect(engineMeasurementOf({ run: eslintRun({ selected: [CLAUSE], measured: [{ clause: CLAUSE, file: FILE_A }] }), inReach: TRACKED })).toBe("measured-something");
  });

  it("says nothing-to-measure for a run with selected clauses when no file is in its reach", () => {
    expect(engineMeasurementOf({ run: eslintRun({ selected: [CLAUSE], measured: [] }), inReach: [] })).toBe("nothing-to-measure");
  });

  it("says nothing-selected for a run with no selected clause", () => {
    expect(engineMeasurementOf({ run: eslintRun({ selected: [], measured: [] }), inReach: TRACKED })).toBe("nothing-selected");
  });
});
