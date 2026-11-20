import { describe, expect, it } from "vitest";
import { AUDIT, CAST_EXPRESSIONS, CLOCK_SOURCES, ESLINT, REPORT_CATALOGUE, TEST_BODY_LOGIC } from "../../tests/report-catalogue.ts";
import type { Finding } from "../governance/governance.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { debtSitesOf } from "./debt-sites.ts";

const ORDER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const WEBHOOK_FILE = repoPathSchema.parse("src/adapters/stripe-webhook.ts");

const CLOCK_FINDING: Finding = { clause: CLOCK_SOURCES, mechanism: AUDIT, file: ORDER_FILE, anchor: { line: 14, column: 0 }, snippet: "chargedAt" };

const CAST_FINDING: Finding = { clause: CAST_EXPRESSIONS, mechanism: ESLINT, file: WEBHOOK_FILE, anchor: { line: 4, column: 9 }, snippet: "body as Event" };

const UNCATALOGUED_FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-99#nowhere"),
  mechanism: AUDIT,
  file: ORDER_FILE,
  anchor: { line: 1, column: 0 },
  snippet: "x",
};

describe("the debt a run's unanswered findings call for", () => {
  it("names a finding by its symptom and the check that found it", () => {
    expect(debtSitesOf({ catalogue: REPORT_CATALOGUE, findings: [CLOCK_FINDING] })).toEqual([{ address: "date-used-directly#clock-sources", file: ORDER_FILE }]);
  });

  it("names a finding by the check it carries over the clause's own", () => {
    expect(debtSitesOf({ catalogue: REPORT_CATALOGUE, findings: [{ ...CLOCK_FINDING, check: "date-used-directly#clock-sources" }] })).toEqual([
      { address: "date-used-directly#clock-sources", file: ORDER_FILE },
    ]);
  });

  it("names a finding by its symptom alone when no check of the symptom found it", () => {
    expect(
      debtSitesOf({ catalogue: { ...REPORT_CATALOGUE, checks: [] }, findings: [CLOCK_FINDING] }),
    ).toEqual([{ address: "date-used-directly", file: ORDER_FILE }]);
  });

  it("lists each symptom, check and file once, ordered by file then address", () => {
    expect(debtSitesOf({ catalogue: REPORT_CATALOGUE, findings: [CLOCK_FINDING, CAST_FINDING, { ...CLOCK_FINDING, anchor: { line: 20, column: 4 } }] })).toEqual([
      { address: "claimed-type#cast-expressions", file: WEBHOOK_FILE },
      { address: "date-used-directly#clock-sources", file: ORDER_FILE },
    ]);
  });

  it("skips a finding whose clause the catalogue does not name a symptom for", () => {
    expect(debtSitesOf({ catalogue: REPORT_CATALOGUE, findings: [UNCATALOGUED_FINDING, { ...CLOCK_FINDING, clause: TEST_BODY_LOGIC }] })).toEqual([]);
  });
});
