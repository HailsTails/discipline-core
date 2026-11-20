import { describe, expect, it } from "vitest";
import { AUDIT, ESLINT, ESLINT_ENGINE, REPORT_CATALOGUE } from "../../tests/report-catalogue.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import type { EngineRun } from "./engine-run.ts";
import { engineProblemsOf, engineUnmeasuredOf } from "./engine-states.ts";

const runWith = (request: { readonly mechanism: EngineRun["mechanism"]; readonly projection: EngineRun["projection"] }): EngineRun => ({
  mechanism: request.mechanism,
  hits: [],
  nativeExceptions: [],
  coverableKinds: [],
  projection: request.projection,
  slices: [],
  unprojectedFolders: [],
  measured: [],
  misnamedRuleIds: [],
});

describe("engineUnmeasuredOf", () => {
  it("names the engine a run left out of effect because its projection is not written", () => {
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "missing" })] })).toEqual([
      { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "missing" },
    ]);
  });

  it("names the engine a run left out of effect because the team's configuration does not include its projection", () => {
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "not-included" })] })).toEqual([
      { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "not-included", nestedConfigurations: [] },
    ]);
  });

  it("names the mechanism when the catalogue gives it no engine", () => {
    const stranger = mechanismIdSchema.parse("stranger");
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: stranger, projection: "missing" })] })).toEqual([
      { kind: "engine-not-run", engine: { name: "stranger", mechanism: stranger }, projection: "missing" },
    ]);
  });

  it("names nothing for a run whose projection is current, out of date or not needed", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [runWith({ mechanism: ESLINT, projection: "current" }), runWith({ mechanism: ESLINT, projection: "out-of-date" }), runWith({ mechanism: AUDIT, projection: "none" })],
      }),
    ).toEqual([]);
  });
});

describe("engineProblemsOf", () => {
  it("names the engine whose projection differs from what project writes now", () => {
    expect(engineProblemsOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "out-of-date" })] })).toEqual([
      { scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" },
    ]);
  });

  it("names nothing for a projection that is current, missing, not included or not needed", () => {
    expect(
      engineProblemsOf({
        catalogue: REPORT_CATALOGUE,
        runs: [
          runWith({ mechanism: ESLINT, projection: "current" }),
          runWith({ mechanism: ESLINT, projection: "missing" }),
          runWith({ mechanism: ESLINT, projection: "not-included" }),
          runWith({ mechanism: AUDIT, projection: "none" }),
        ],
      }),
    ).toEqual([]);
  });
});
