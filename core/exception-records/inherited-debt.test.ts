import { describe, expect, it } from "vitest";
import type { AttributedNativeException, Finding } from "../governance/governance.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { INHERITED_DEBT_REASON, inheritedDebtEntriesOf, inheritedDebtOf, type InheritedDebtRequest } from "./inherited-debt.ts";

const LOOPS = clauseAddressSchema.parse("CD-15#loops");
const CASTS = clauseAddressSchema.parse("CD-2#cast-expressions");
const TEAM_CLAUSE = clauseAddressSchema.parse("team/TM-1#no-tmp-files");
const AUDIT = mechanismIdSchema.parse("audit");
const BASKET = repoPathSchema.parse("src/basket.ts");
const LEGACY = repoPathSchema.parse("src/legacy/report.ts");
const FRESH = repoPathSchema.parse("src/fresh.ts");

const findingAt = (request: { readonly clause: Finding["clause"]; readonly file: Finding["file"]; readonly line: number }): Finding => ({
  clause: request.clause,
  mechanism: AUDIT,
  file: request.file,
  anchor: { line: request.line, column: 0 },
  snippet: "const total = 0;",
});

const directiveAt = (request: { readonly file: Finding["file"]; readonly line: number }): AttributedNativeException => ({
  kind: "inline-disable",
  clause: CASTS,
  mechanism: AUDIT,
  file: request.file,
  line: request.line,
  text: "// @ts-expect-error",
  reach: "one-clause",
});

const NOTHING: InheritedDebtRequest = {
  findings: [],
  unrecorded: [],
  existing: [],
  leave: [],
  inBase: new Set([BASKET, LEGACY]),
  refusing: [],
};

describe("inheritedDebtOf choosing pairs", () => {
  it("names each clause and file once, however many findings it holds, ordered by file and then clause", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [
          findingAt({ clause: LOOPS, file: LEGACY, line: 3 }),
          findingAt({ clause: LOOPS, file: BASKET, line: 9 }),
          findingAt({ clause: LOOPS, file: BASKET, line: 4 }),
          findingAt({ clause: CASTS, file: BASKET, line: 2 }),
        ],
      }),
    ).toEqual([
      { clause: LOOPS, file: BASKET, effect: "recorded" },
      { clause: CASTS, file: BASKET, effect: "recorded" },
      { clause: LOOPS, file: LEGACY, effect: "recorded" },
    ]);
  });

  it("records an unrecorded inline disable or directive as debt on its clause and file, beside a finding there", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: CASTS, file: BASKET, line: 2 })],
        unrecorded: [directiveAt({ file: BASKET, line: 7 }), directiveAt({ file: LEGACY, line: 1 })],
      }),
    ).toEqual([
      { clause: CASTS, file: BASKET, effect: "recorded" },
      { clause: CASTS, file: LEGACY, effect: "recorded" },
    ]);
  });

  it("leaves every other unrecorded native exception to the person, since a file record cannot hold it the same way", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        unrecorded: [
          { kind: "config-override", clause: LOOPS, mechanism: AUDIT, file: BASKET },
          {
            kind: "command-line-option",
            clause: LOOPS,
            mechanism: AUDIT,
            location: repoPathSchema.parse("package.json"),
            script: "lint",
            option: "--rule",
            cause: { kind: "weakens-run" },
          },
        ],
      }),
    ).toEqual([]);
  });

});

describe("inheritedDebtOf writing nothing for a pair", () => {
  it("does not record a pair that already has a record on that clause and file, whatever its kind or how its clause is spelled", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: LOOPS, file: BASKET, line: 4 }), findingAt({ clause: LOOPS, file: LEGACY, line: 4 })],
        existing: [
          { kind: "file-carve-out", clause: "hone/CD-15#loops", file: "src/basket.ts", reason: "forfeited since the base" },
          { kind: "authorised-location", clause: "CD-15#loops", file: "src/legacy/report.ts", reason: "an invalid one" },
        ],
      }),
    ).toEqual([
      { clause: LOOPS, file: BASKET, effect: "already-recorded" },
      { clause: LOOPS, file: LEGACY, effect: "already-recorded" },
    ]);
  });

  it("is not stopped by a clause-wide carve-out or by an entry whose clause cannot be read", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: LOOPS, file: BASKET, line: 4 })],
        existing: [
          { kind: "clause-wide-carve-out", clause: "CD-15#loops", reason: "refused for its chain", whyChain: {} },
          { kind: "file-carve-out", clause: "not an address", file: "src/basket.ts", reason: "unreadable" },
        ],
      }),
    ).toEqual([{ clause: LOOPS, file: BASKET, effect: "recorded" }]);
  });

});

describe("inheritedDebtOf leaving a pair for a person", () => {
  it("leaves a file under a --leave path, naming the path, for a person to record as an authorised location", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: LOOPS, file: LEGACY, line: 3 }), findingAt({ clause: LOOPS, file: BASKET, line: 3 })],
        leave: [repoPathSchema.parse("src/legacy"), repoPathSchema.parse("src/basket.ts")],
      }),
    ).toEqual([
      { clause: LOOPS, file: BASKET, effect: "left", under: repoPathSchema.parse("src/basket.ts") },
      { clause: LOOPS, file: LEGACY, effect: "left", under: repoPathSchema.parse("src/legacy") },
    ]);
  });

  it("does not take a --leave folder for a prefix of a longer name", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: LOOPS, file: LEGACY, line: 3 })],
        leave: [repoPathSchema.parse("src/leg")],
      }),
    ).toEqual([{ clause: LOOPS, file: LEGACY, effect: "recorded" }]);
  });

  it("does not record a file the base revision does not hold, since nothing in it was inherited", () => {
    expect(
      inheritedDebtOf({ ...NOTHING, findings: [findingAt({ clause: LOOPS, file: FRESH, line: 1 })] }),
    ).toEqual([{ clause: LOOPS, file: FRESH, effect: "new-file" }]);
  });

  it("does not record a clause whose discipline refuses exceptions", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: TEAM_CLAUSE, file: BASKET, line: 1 })],
        refusing: [TEAM_CLAUSE],
      }),
    ).toEqual([{ clause: TEAM_CLAUSE, file: BASKET, effect: "refused" }]);
  });
});

describe("inheritedDebtEntriesOf", () => {
  it("writes one reason-only file carve-out for each recorded pair, with the clause as the report prints it", () => {
    expect(
      inheritedDebtEntriesOf({
        outcomes: [
          { clause: TEAM_CLAUSE, file: BASKET, effect: "recorded" },
          { clause: LOOPS, file: LEGACY, effect: "left", under: LEGACY },
          { clause: LOOPS, file: FRESH, effect: "new-file" },
        ],
      }),
    ).toEqual([{ kind: "file-carve-out", clause: "team/TM-1#no-tmp-files", file: "src/basket.ts", reason: INHERITED_DEBT_REASON }]);
  });

  it("gives a reason that says the debt was inherited and that nobody reviewed it", () => {
    expect(INHERITED_DEBT_REASON).toBe(
      "Inherited debt: this file was already in the repository before Hone was adopted, and broke this clause when hone record-debt wrote this record. Nobody has reviewed it or decided it should stay. The record is forfeited when the file next changes.",
    );
  });
});
