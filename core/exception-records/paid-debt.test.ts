import { describe, expect, it } from "vitest";
import type { AttributedNativeException, Finding } from "../governance/governance.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { CAUSAL_WHY_CHAIN } from "../../tests/causal-why-chain.ts";
import type { ExceptionRecord } from "./exception-record.ts";
import { paidDebtOf, type PaidDebtRequest } from "./paid-debt.ts";

const LOOPS = clauseAddressSchema.parse("CD-15#loops");
const CASTS = clauseAddressSchema.parse("CD-2#cast-expressions");
const AUDIT = mechanismIdSchema.parse("audit");
const ESLINT = mechanismIdSchema.parse("eslint");
const BASKET = repoPathSchema.parse("src/basket.ts");
const LEGACY = repoPathSchema.parse("src/legacy/report.ts");

const carveOut = (request: { readonly clause: Finding["clause"]; readonly file: Finding["file"] }): ExceptionRecord => ({
  kind: "file-carve-out",
  clause: request.clause,
  mechanism: ESLINT,
  file: request.file,
});

const findingAt = (request: { readonly clause: Finding["clause"]; readonly file: Finding["file"] }): Finding => ({
  clause: request.clause,
  mechanism: ESLINT,
  file: request.file,
  anchor: { line: 1, column: 0 },
  snippet: "const total = basket.total;",
});

const directiveAt = (request: { readonly clause: Finding["clause"]; readonly file: Finding["file"] }): AttributedNativeException => ({
  kind: "inline-disable",
  clause: request.clause,
  mechanism: ESLINT,
  file: request.file,
  line: 1,
  text: "// eslint-disable-next-line",
  reach: "one-clause",
});

const NOTHING: PaidDebtRequest = { findings: [], exempted: [], stale: [], forfeited: [], unrecorded: [], unrunMechanisms: [], excluded: [] };

const CHECKOUT = repoPathSchema.parse("src/checkout.ts");
const PRICES = repoPathSchema.parse("src/prices.ts");
const TOTALS = repoPathSchema.parse("src/totals.ts");
const PACKAGE_JSON = repoPathSchema.parse("package.json");

describe("paidDebtOf choosing stale records", () => {
  it("names each stale file carve-out, ordered by file and then clause", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        stale: [carveOut({ clause: LOOPS, file: LEGACY }), carveOut({ clause: CASTS, file: BASKET }), carveOut({ clause: LOOPS, file: BASKET })],
      }),
    ).toEqual([
      { clause: LOOPS, file: BASKET },
      { clause: CASTS, file: BASKET },
      { clause: LOOPS, file: LEGACY },
    ]);
  });

  it("leaves a stale authorised location and a stale clause-wide carve-out to a person", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        stale: [
          { kind: "authorised-location", clause: LOOPS, mechanism: AUDIT, file: BASKET, reason: "the one loop over the clock" },
          { kind: "clause-wide-carve-out", clause: CASTS, mechanism: ESLINT, reason: "casts carved out during migration", whyChain: CAUSAL_WHY_CHAIN },
        ],
      }),
    ).toEqual([]);
  });
});

describe("paidDebtOf choosing forfeited records by their own clause and file", () => {
  it("names a forfeited file carve-out whose clause and file hold no finding and no native exception", () => {
    expect(paidDebtOf({ ...NOTHING, forfeited: [carveOut({ clause: LOOPS, file: BASKET })] })).toEqual([{ clause: LOOPS, file: BASKET }]);
  });

  it("keeps a forfeited file carve-out whose clause and file still hold a finding", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        findings: [findingAt({ clause: LOOPS, file: BASKET })],
      }),
    ).toEqual([]);
  });

  it("keeps a forfeited file carve-out whose clause and file hold a finding another record exempts", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        exempted: [{ finding: findingAt({ clause: LOOPS, file: BASKET }), by: [carveOut({ clause: LOOPS, file: BASKET })] }],
      }),
    ).toEqual([]);
  });

  it("keeps a forfeited file carve-out whose clause and file hold an unrecorded inline disable", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        unrecorded: [directiveAt({ clause: LOOPS, file: BASKET })],
      }),
    ).toEqual([]);
  });
});

describe("paidDebtOf naming forfeited records beside other entries", () => {
  it("names a forfeited file carve-out whose findings are all on another clause or another file", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        findings: [findingAt({ clause: CASTS, file: BASKET }), findingAt({ clause: LOOPS, file: LEGACY })],
      }),
    ).toEqual([{ clause: LOOPS, file: BASKET }]);
  });

  it("names a forfeited file carve-out whose file is held only by a script option, which names no file", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [carveOut({ clause: LOOPS, file: BASKET })],
        unrecorded: [
          {
            kind: "command-line-option",
            clause: LOOPS,
            mechanism: ESLINT,
            location: PACKAGE_JSON,
            script: "lint",
            option: "--rule hone/no-for-of: off",
            cause: { kind: "weakens-run" },
          },
        ],
      }),
    ).toEqual([{ clause: LOOPS, file: BASKET }]);
  });

  it("names a pair once when it is both stale and forfeited", () => {
    expect(
      paidDebtOf({ ...NOTHING, stale: [carveOut({ clause: LOOPS, file: BASKET })], forfeited: [carveOut({ clause: LOOPS, file: BASKET })] }),
    ).toEqual([{ clause: LOOPS, file: BASKET }]);
  });
});

describe("paidDebtOf leaving debt it could not measure", () => {
  it("leaves a stale file carve-out whose mechanism did not run, naming one whose mechanism ran", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        stale: [carveOut({ clause: LOOPS, file: BASKET }), { kind: "file-carve-out", clause: LOOPS, mechanism: AUDIT, file: LEGACY }],
        unrunMechanisms: [ESLINT],
      }),
    ).toEqual([{ clause: LOOPS, file: LEGACY }]);
  });

  it("leaves a forfeited file carve-out whose mechanism did not run", () => {
    expect(paidDebtOf({ ...NOTHING, forfeited: [carveOut({ clause: LOOPS, file: BASKET })], unrunMechanisms: [ESLINT] })).toEqual([]);
  });

  it("leaves a stale file carve-out on a file the selection excludes, as an exact file or under a folder", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        stale: [carveOut({ clause: LOOPS, file: BASKET }), carveOut({ clause: LOOPS, file: LEGACY }), carveOut({ clause: LOOPS, file: CHECKOUT })],
        excluded: [BASKET, repoPathSchema.parse("src/legacy")],
      }),
    ).toEqual([{ clause: LOOPS, file: CHECKOUT }]);
  });

  it("names a stale file carve-out on a file that only shares a name prefix with an excluded folder", () => {
    expect(
      paidDebtOf({ ...NOTHING, stale: [carveOut({ clause: LOOPS, file: BASKET })], excluded: [repoPathSchema.parse("src/bask")] }),
    ).toEqual([{ clause: LOOPS, file: BASKET }]);
  });
});

describe("paidDebtOf keeping a forfeited record each native exception on its file holds", () => {
  it("keeps a forfeited file carve-out held by an ignore, a config override, a suppression entry or an inline rule config on its clause and file", () => {
    expect(
      paidDebtOf({
        ...NOTHING,
        forfeited: [
          carveOut({ clause: LOOPS, file: BASKET }),
          carveOut({ clause: LOOPS, file: CHECKOUT }),
          carveOut({ clause: LOOPS, file: PRICES }),
          carveOut({ clause: LOOPS, file: TOTALS }),
        ],
        unrecorded: [
          { kind: "ignore", clause: LOOPS, mechanism: ESLINT, file: BASKET },
          { kind: "config-override", clause: LOOPS, mechanism: ESLINT, file: CHECKOUT },
          { kind: "suppression-entry", clause: LOOPS, mechanism: ESLINT, file: PRICES, location: repoPathSchema.parse("eslint-suppressions.json") },
          { kind: "inline-rule-config", clause: LOOPS, mechanism: ESLINT, file: TOTALS, line: 1, text: "/* eslint hone/no-for-of: off */" },
        ],
      }),
    ).toEqual([]);
  });
});
