import { describe, expect, it } from "vitest";
import { DATE_USED_DIRECTLY, WHOLE_SYMPTOM } from "../../tests/report-catalogue.ts";
import type { Authorising } from "../records/authorising.ts";
import type { DebtOutcome } from "../records/debt-effects.ts";
import type { Debt } from "../records/hone-record.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { authorisingLines, debtOutcomeLine, prunedDebtLine } from "./record-command-lines.ts";

const FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const RECORDS_FILE = repoPathSchema.parse("hone-records/debt/date-used-directly.json");

const SITE = { address: "date-used-directly#clock-sources", file: FILE } as const;

const OUTCOME_LINES: readonly (readonly [DebtOutcome, string])[] = [
  [{ ...SITE, effect: "recorded" }, "date-used-directly#clock-sources recorded src/orders/charge-order.ts"],
  [
    { ...SITE, effect: "already-recorded", heldIn: RECORDS_FILE },
    "date-used-directly#clock-sources already-recorded src/orders/charge-order.ts: hone-records/debt/date-used-directly.json already holds debt on this symptom and file; the check says why it does not answer",
  ],
  [
    { ...SITE, effect: "left", under: repoPathSchema.parse("src/orders") },
    "date-used-directly#clock-sources left src/orders/charge-order.ts: under --leave src/orders; record it as an authorised location with its own reason, or fix it",
  ],
  [
    { ...SITE, effect: "touched" },
    "date-used-directly#clock-sources touched src/orders/charge-order.ts: this change created or changed the file, so this run would forfeit debt on it; fix the finding there",
  ],
  [
    { address: "CD-99#nowhere", file: FILE, effect: "unrecordable" },
    "CD-99#nowhere unrecordable src/orders/charge-order.ts: the catalogue gives this finding no symptom or check to record debt against; fix the finding",
  ],
];

const DEBT: Debt = { kind: "debt", symptom: DATE_USED_DIRECTLY, reach: WHOLE_SYMPTOM, file: FILE, holding: { held: "stated" } };

const PLACE = { file: RECORDS_FILE, index: 0 };

describe("the lines hone record-debt prints", () => {
  it.each(OUTCOME_LINES)("prints %j as one line", (outcome, line) => {
    expect(debtOutcomeLine({ outcome })).toBe(line);
  });
});

describe("the lines hone prune-debt prints", () => {
  it("prints each debt it removed with the reason the report listed it for", () => {
    expect(prunedDebtLine({ pruned: { place: PLACE, debt: DEBT, reason: "paid" } })).toBe("date-used-directly removed src/orders/charge-order.ts: paid");
    expect(prunedDebtLine({ pruned: { place: PLACE, debt: DEBT, reason: "stale" } })).toBe("date-used-directly removed src/orders/charge-order.ts: stale");
    expect(prunedDebtLine({ pruned: { place: PLACE, debt: DEBT, reason: "forfeited" } })).toBe("date-used-directly removed src/orders/charge-order.ts: forfeited");
  });
});

describe("the lines hone authorise prints", () => {
  const AUTHORISE = { address: "claimed-type#cast-expressions", file: FILE };

  it("prints one line for a record it wrote", () => {
    const accepted: Authorising = { judged: "accepted", edit: { write: [], remove: [] } };
    expect(authorisingLines({ ...AUTHORISE, authorising: accepted })).toEqual(["claimed-type#cast-expressions authorised src/orders/charge-order.ts"]);
  });

  it("prints one line for a record already held, and where", () => {
    expect(authorisingLines({ ...AUTHORISE, authorising: { judged: "already-held", heldIn: RECORDS_FILE } })).toEqual([
      "claimed-type#cast-expressions already-authorised src/orders/charge-order.ts: hone-records/debt/date-used-directly.json already holds this record",
    ]);
  });

  it("prints one line for each reason it refused", () => {
    expect(
      authorisingLines({
        ...AUTHORISE,
        authorising: { judged: "refused", refusals: [{ kind: "unknown-symptom", symptom: "no-such-symptom" }, { kind: "not-a-records-name", name: "Not A Name" }] },
      }),
    ).toEqual([
      'claimed-type#cast-expressions refused src/orders/charge-order.ts: unknown-symptom "no-such-symptom"',
      'claimed-type#cast-expressions refused src/orders/charge-order.ts: not-a-records-name "Not A Name"',
    ]);
  });
});
