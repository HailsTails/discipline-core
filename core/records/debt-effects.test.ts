import { describe, expect, it } from "vitest";
import { CAST_CHECK, CLAIMED_TYPE, CLOCK_CHECK, DATE_USED_DIRECTLY, WHOLE_SYMPTOM } from "../../tests/report-catalogue.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { type DebtEffectsRequest, debtOutcomesOf } from "./debt-effects.ts";
import type { PlacedRecord } from "./hone-record.ts";

const ORDER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const NEW_FILE = repoPathSchema.parse("src/orders/refund-order.ts");

const TOUCHED_FILE = repoPathSchema.parse("src/orders/edited-order.ts");

const LEFT_FOLDER = repoPathSchema.parse("src/legacy");

const LEFT_FILE = repoPathSchema.parse("src/legacy/old-order.ts");

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/date-used-directly.json");

const CLOCK_ADDRESS = "date-used-directly#clock-sources";

const HELD_CLOCK_DEBT: PlacedRecord = {
  place: { file: DEBT_FILE, index: 0 },
  record: { kind: "debt", symptom: DATE_USED_DIRECTLY, reach: { reaches: "one-check", check: CLOCK_CHECK }, file: ORDER_FILE, holding: { held: "stated" } },
};

const HELD_WHOLE_SYMPTOM_DEBT: PlacedRecord = {
  place: { file: DEBT_FILE, index: 1 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: ORDER_FILE, holding: { held: "stated" } },
};

const HELD_CAST_DEBT: PlacedRecord = {
  place: { file: DEBT_FILE, index: 2 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: { reaches: "one-check", check: CAST_CHECK }, file: ORDER_FILE, holding: { held: "stated" } },
};

const REQUEST: DebtEffectsRequest = {
  sites: [{ address: CLOCK_ADDRESS, file: ORDER_FILE }],
  unrecordable: [],
  records: [],
  leave: [],
  touched: { measured: "yes", paths: new Set([TOUCHED_FILE, NEW_FILE]) },
};

describe("what record-debt does with each symptom and file the check finds", () => {
  it("records debt on a file this change left alone", () => {
    expect(debtOutcomesOf(REQUEST)).toEqual([{ address: CLOCK_ADDRESS, file: ORDER_FILE, effect: "recorded" }]);
  });

  it("writes nothing for debt already held on the same symptom, check and file, and says where it sits", () => {
    expect(debtOutcomesOf({ ...REQUEST, records: [HELD_CLOCK_DEBT] })).toEqual([{ address: CLOCK_ADDRESS, file: ORDER_FILE, effect: "already-recorded", heldIn: DEBT_FILE }]);
  });

  it("holds a whole-symptom debt to its symptom and a one-check debt to its check", () => {
    expect(
      debtOutcomesOf({
        ...REQUEST,
        sites: [
          { address: "claimed-type", file: ORDER_FILE },
          { address: "claimed-type#cast-expressions", file: ORDER_FILE },
        ],
        records: [HELD_WHOLE_SYMPTOM_DEBT],
      }),
    ).toEqual([
      { address: "claimed-type", file: ORDER_FILE, effect: "already-recorded", heldIn: DEBT_FILE },
      { address: "claimed-type#cast-expressions", file: ORDER_FILE, effect: "recorded" },
    ]);
  });

  it("does not take another file's debt, or another check's, for this one", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: "claimed-type#cast-expressions", file: LEFT_FILE }], records: [HELD_CAST_DEBT] })).toEqual([
      { address: "claimed-type#cast-expressions", file: LEFT_FILE, effect: "recorded" },
    ]);
  });

  it("leaves a file under a --leave path, naming the path", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: CLOCK_ADDRESS, file: LEFT_FILE }], leave: [LEFT_FOLDER] })).toEqual([
      { address: CLOCK_ADDRESS, file: LEFT_FILE, effect: "left", under: LEFT_FOLDER },
    ]);
  });

  it("leaves a file that is exactly a --leave path", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: CLOCK_ADDRESS, file: ORDER_FILE }], leave: [ORDER_FILE] })).toEqual([
      { address: CLOCK_ADDRESS, file: ORDER_FILE, effect: "left", under: ORDER_FILE },
    ]);
  });

  it("does not record debt on a file this change changed, since the run would forfeit it", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: CLOCK_ADDRESS, file: TOUCHED_FILE }] })).toEqual([{ address: CLOCK_ADDRESS, file: TOUCHED_FILE, effect: "touched" }]);
  });

  it("does not record debt on a file this change created, since the run would forfeit it", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: CLOCK_ADDRESS, file: NEW_FILE }] })).toEqual([{ address: CLOCK_ADDRESS, file: NEW_FILE, effect: "touched" }]);
  });

  it("records debt on a file this change changed when another run assesses forfeiture", () => {
    expect(debtOutcomesOf({ ...REQUEST, sites: [{ address: CLOCK_ADDRESS, file: TOUCHED_FILE }], touched: { measured: "elsewhere" } })).toEqual([
      { address: CLOCK_ADDRESS, file: TOUCHED_FILE, effect: "recorded" },
    ]);
  });

  it("gives a finding no debt can be written for its own line, ordered by file with the rest", () => {
    expect(debtOutcomesOf({ ...REQUEST, unrecordable: [{ address: "CD-99#nowhere", file: LEFT_FILE, because: "no-check" }, { address: "CD-98#nowhere", file: ORDER_FILE, because: "no-check" }] })).toEqual([
      { address: "CD-99#nowhere", file: LEFT_FILE, effect: "unrecordable", because: "no-check" },
      { address: "CD-98#nowhere", file: ORDER_FILE, effect: "unrecordable", because: "no-check" },
      { address: CLOCK_ADDRESS, file: ORDER_FILE, effect: "recorded" },
    ]);
  });
});
