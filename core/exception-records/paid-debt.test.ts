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

const NOTHING: PaidDebtRequest = { findings: [], exempted: [], stale: [], forfeited: [], unrecorded: [] };

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
            location: repoPathSchema.parse("package.json"),
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
