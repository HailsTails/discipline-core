import { describe, expect, it } from "vitest";
import { AUDIT, ESLINT, ESLINT_ENGINE, REPORT_CATALOGUE } from "../../tests/report-catalogue.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
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
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "missing" })], selected: [] })).toEqual([
      { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "missing" },
    ]);
  });

  it("names the engine a run left out of effect because the team's configuration does not include its projection", () => {
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "not-included" })], selected: [] })).toEqual([
      { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "not-included", nestedConfigurations: [] },
    ]);
  });

  it("names the mechanism when the catalogue gives it no engine", () => {
    const stranger = mechanismIdSchema.parse("stranger");
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: stranger, projection: "missing" })], selected: [] })).toEqual([
      { kind: "engine-not-run", engine: { name: "stranger", mechanism: stranger }, projection: "missing" },
    ]);
  });

  it("names nothing for a run whose projection is current, out of date or not needed", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [runWith({ mechanism: ESLINT, projection: "current" }), runWith({ mechanism: ESLINT, projection: "out-of-date" }), runWith({ mechanism: AUDIT, projection: "none" })],
        selected: [],
      }),
    ).toEqual([]);
  });
});

describe("engineUnmeasuredOf, an engine that measured nothing", () => {
  const CLAUSE = clauseAddressSchema.parse("CD-2#cast-expressions");

  const SELECTED = [{ address: CLAUSE, mechanism: ESLINT, exceptions: "allowed" as const }];

  const MEASURED_NOTHING = { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "measured-nothing" };

  it("names an engine with selected checks that measured no file under a current or out-of-date projection", () => {
    expect(
      engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "current" }), runWith({ mechanism: ESLINT, projection: "out-of-date" })], selected: SELECTED }),
    ).toEqual([MEASURED_NOTHING, MEASURED_NOTHING]);
  });

  it("names the missing projection and not the engine measuring nothing when both hold", () => {
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "missing" })], selected: SELECTED })).toEqual([
      { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "missing" },
    ]);
  });

  it("names nothing for an engine that measured a file, one that needs no projection, or one with no selected check", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [{ ...runWith({ mechanism: ESLINT, projection: "current" }), measured: [{ clause: CLAUSE, file: repoPathSchema.parse("src/a.ts") }] }, runWith({ mechanism: AUDIT, projection: "none" })],
        selected: [...SELECTED, { address: CLAUSE, mechanism: AUDIT, exceptions: "allowed" as const }],
      }),
    ).toEqual([]);
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "current" })], selected: [] })).toEqual([]);
  });
});

describe("engineProblemsOf", () => {
  it("names the engine whose projection differs from what project writes now", () => {
    expect(engineProblemsOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "out-of-date" })] })).toEqual([
      { scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" },
    ]);
  });

  it("names each package file a run found missing, out of date or not loaded, beside a current root projection", () => {
    const run: EngineRun = {
      ...runWith({ mechanism: ESLINT, projection: "current" }),
      slices: [
        { slice: repoPathSchema.parse("packages/a/hone.eslint.mjs"), state: "missing" },
        { slice: repoPathSchema.parse("packages/b/hone.eslint.mjs"), state: "out-of-date" },
        { slice: repoPathSchema.parse("packages/c/hone.eslint.mjs"), state: "unconfigured" },
      ],
    };
    expect(engineProblemsOf({ catalogue: REPORT_CATALOGUE, runs: [run] })).toEqual([
      { scope: "slice", engine: ESLINT_ENGINE, state: "missing", slice: "packages/a/hone.eslint.mjs" },
      { scope: "slice", engine: ESLINT_ENGINE, state: "out-of-date", slice: "packages/b/hone.eslint.mjs" },
      { scope: "slice", engine: ESLINT_ENGINE, state: "unconfigured", slice: "packages/c/hone.eslint.mjs" },
    ]);
  });

  it("names the root projection first, then the package files, when both differ", () => {
    const run: EngineRun = {
      ...runWith({ mechanism: ESLINT, projection: "out-of-date" }),
      slices: [{ slice: repoPathSchema.parse("packages/a/hone.eslint.mjs"), state: "out-of-date" }],
    };
    expect(engineProblemsOf({ catalogue: REPORT_CATALOGUE, runs: [run] })).toEqual([
      { scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" },
      { scope: "slice", engine: ESLINT_ENGINE, state: "out-of-date", slice: "packages/a/hone.eslint.mjs" },
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
