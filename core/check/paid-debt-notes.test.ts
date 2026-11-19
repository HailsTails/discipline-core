import { describe, expect, it } from "vitest";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { Finding, GovernanceResult } from "../governance/governance.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { paidDebtNotesOf } from "./paid-debt-notes.ts";

const LOOPS = clauseAddressSchema.parse("CD-15#loops");
const AUDIT = mechanismIdSchema.parse("audit");
const ESLINT = mechanismIdSchema.parse("eslint");
const BASKET = repoPathSchema.parse("src/basket.ts");
const LEGACY = repoPathSchema.parse("src/legacy/report.ts");

const ESLINT_CARVE_OUT_ON_BASKET: ExceptionRecord = { kind: "file-carve-out", clause: LOOPS, mechanism: ESLINT, file: BASKET };

const AUDIT_CARVE_OUT_ON_LEGACY: ExceptionRecord = { kind: "file-carve-out", clause: LOOPS, mechanism: AUDIT, file: LEGACY };

const FINDING_ON_LEGACY: Finding = {
  clause: LOOPS,
  mechanism: AUDIT,
  file: LEGACY,
  anchor: { line: 1, column: 0 },
  snippet: "const total = report.total;",
};

const NOTHING_GOVERNED: GovernanceResult = { findings: [], exempted: [], stale: [], forfeited: [], doublyHeld: [], unrecorded: [] };

describe("paidDebtNotesOf", () => {
  it("gives no note when no debt is paid", () => {
    expect(paidDebtNotesOf({ governed: NOTHING_GOVERNED, runs: [{ mechanism: ESLINT, projection: "current" }] })).toEqual([]);
  });

  it("counts each paid file carve-out, naming the projecting mechanism that held one", () => {
    expect(
      paidDebtNotesOf({
        governed: { ...NOTHING_GOVERNED, stale: [ESLINT_CARVE_OUT_ON_BASKET], forfeited: [AUDIT_CARVE_OUT_ON_LEGACY] },
        runs: [
          { mechanism: ESLINT, projection: "current" },
          { mechanism: AUDIT, projection: "none" },
        ],
      }),
    ).toEqual([{ kind: "paid-debt", fileCarveOuts: 2, projections: ["eslint"] }]);
  });

  it("names no projection for a paid carve-out whose mechanism projects nothing", () => {
    expect(
      paidDebtNotesOf({
        governed: { ...NOTHING_GOVERNED, stale: [AUDIT_CARVE_OUT_ON_LEGACY] },
        runs: [{ mechanism: AUDIT, projection: "none" }],
      }),
    ).toEqual([{ kind: "paid-debt", fileCarveOuts: 1, projections: [] }]);
  });

  it("names no projection for a forfeited carve-out its file still breaks, since that debt is not paid", () => {
    expect(
      paidDebtNotesOf({
        governed: {
          ...NOTHING_GOVERNED,
          stale: [ESLINT_CARVE_OUT_ON_BASKET],
          forfeited: [AUDIT_CARVE_OUT_ON_LEGACY],
          findings: [FINDING_ON_LEGACY],
        },
        runs: [
          { mechanism: ESLINT, projection: "none" },
          { mechanism: AUDIT, projection: "current" },
        ],
      }),
    ).toEqual([{ kind: "paid-debt", fileCarveOuts: 1, projections: [] }]);
  });
});
