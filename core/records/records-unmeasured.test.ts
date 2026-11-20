import { describe, expect, it } from "vitest";
import type { Symptom } from "../symptom-catalogue/symptom-catalogue.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { PlacedRecord } from "./hone-record.ts";
import { recordsUnmeasuredOf } from "./records-unmeasured.ts";

const CLAIMED_TYPE: Symptom = { name: "claimed-type", title: "Claimed type", seen: "A cast.", mayIndicate: [], breachUsuallySits: "in the unit", recipes: [], correctUses: [] };

const FILE_A = repoPathSchema.parse("src/a.ts");

const STATED_DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 0 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: { reaches: "whole-symptom" }, file: FILE_A, holding: { held: "stated" } },
};

const CARRIED_LOCATION: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/authorised-locations/claimed-type.json"), index: 0 },
  record: {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: { reaches: "whole-symptom" },
    file: FILE_A,
    holding: { held: "carried", entry: { reason: "Kept." }, lacks: ["case", "owes", "whyChain"], standing: "unjudged" },
  },
};

const ZOD_DEPENDENCY: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/dependencies.json"), index: 0 },
  record: { kind: "dependency-record", dependency: "zod", nativeWay: "hand-written parsing", whyNotEnough: "Each adapter would repeat its checks." },
};

describe("recordsUnmeasuredOf", () => {
  it("lists forfeiture unmeasured when the touched set is unmeasured and debt exists", () => {
    expect(
      recordsUnmeasuredOf({ records: [STATED_DEBT], base: { measured: "yes" }, touched: { measured: "no", base: { state: "not-given" } } }),
    ).toEqual([{ kind: "forfeiture-unmeasured", base: { state: "not-given" } }]);
  });

  it("lists import unmeasured when the base was not measured and a carried record exists, which still answers", () => {
    expect(
      recordsUnmeasuredOf({
        records: [CARRIED_LOCATION],
        base: { measured: "no", base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" } },
        touched: { measured: "yes", paths: new Set() },
      }),
    ).toEqual([{ kind: "import-unmeasured", base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" } }]);
  });

  it("lists forfeiture before import, as version 1 does", () => {
    expect(
      recordsUnmeasuredOf({
        records: [STATED_DEBT, CARRIED_LOCATION],
        base: { measured: "no", base: { state: "not-given" } },
        touched: { measured: "no", base: { state: "not-given" } },
      }),
    ).toEqual([
      { kind: "forfeiture-unmeasured", base: { state: "not-given" } },
      { kind: "import-unmeasured", base: { state: "not-given" } },
    ]);
  });

  it("lists nothing when nothing needs the base, though neither was measured", () => {
    expect(
      recordsUnmeasuredOf({ records: [ZOD_DEPENDENCY], base: { measured: "no", base: { state: "not-given" } }, touched: { measured: "no", base: { state: "not-given" } } }),
    ).toEqual([]);
  });

  it("lists nothing when forfeiture is measured elsewhere and the base was measured", () => {
    expect(recordsUnmeasuredOf({ records: [STATED_DEBT, CARRIED_LOCATION], base: { measured: "yes" }, touched: { measured: "elsewhere" } })).toEqual([]);
  });
});
