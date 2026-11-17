import { describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../tests/causal-why-chain.ts";
import type { ClauseBinding } from "../consumer-selection/consumer-selection.ts";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { bindingsToLoad, bindingsToRun, notRunClauses, waivedClausesAssessmentOf } from "./waived-clauses.ts";

const audit = mechanismIdSchema.parse("audit");
const eslint = mechanismIdSchema.parse("eslint");
const identifierNames = clauseAddressSchema.parse("CD-6#identifier-names");
const namingConvention = clauseAddressSchema.parse("CD-6#naming-convention");
const functionLength = clauseAddressSchema.parse("CD-41#function-length");

const bindingOf = (request: { readonly address: typeof identifierNames; readonly mechanism: typeof audit }): ClauseBinding => ({
  mechanism: request.mechanism,
  clause: { address: request.address, anchor: { kind: "file" }, pieceRoot: "/install/mechanisms", settings: {}, clauseSettings: {} },
});

const auditNames = bindingOf({ address: identifierNames, mechanism: audit });
const eslintNaming = bindingOf({ address: namingConvention, mechanism: eslint });
const eslintLength = bindingOf({ address: functionLength, mechanism: eslint });
const auditLength = bindingOf({ address: functionLength, mechanism: audit });

const waiverOf = (request: { readonly clause: typeof identifierNames; readonly mechanism: typeof audit }): ExceptionRecord => ({
  kind: "clause-wide-carve-out",
  clause: request.clause,
  mechanism: request.mechanism,
  reason: "not adopted yet",
  whyChain: CAUSAL_WHY_CHAIN,
});

const namingWaiver = waiverOf({ clause: namingConvention, mechanism: eslint });

const namingCarveOut: ExceptionRecord = {
  kind: "file-carve-out",
  clause: namingConvention,
  mechanism: eslint,
  file: repoPathSchema.parse("src/a.ts"),
  reason: "legacy names",
  whyChain: CAUSAL_WHY_CHAIN,
};

describe("bindingsToLoad", () => {
  it("loads every binding when waived clauses run", () => {
    expect(bindingsToLoad({ waivedClauses: "run", records: [namingWaiver], bindings: [auditNames, eslintNaming] })).toEqual([
      auditNames,
      eslintNaming,
    ]);
  });

  it("leaves out a mechanism whose every clause is waived when waived clauses are not run", () => {
    expect(bindingsToLoad({ waivedClauses: "not-run", records: [namingWaiver], bindings: [auditNames, eslintNaming] })).toEqual([
      auditNames,
    ]);
  });

  it("keeps every binding of a mechanism that still has a clause in force", () => {
    expect(
      bindingsToLoad({ waivedClauses: "not-run", records: [namingWaiver], bindings: [auditNames, eslintNaming, eslintLength] }),
    ).toEqual([auditNames, eslintNaming, eslintLength]);
  });

  it("treats only a clause-wide carve-out as a waiver", () => {
    expect(bindingsToLoad({ waivedClauses: "not-run", records: [namingCarveOut], bindings: [eslintNaming] })).toEqual([
      eslintNaming,
    ]);
  });
});

describe("bindingsToRun", () => {
  it("runs only the clauses in force when waived clauses are not run", () => {
    const waiver = waiverOf({ clause: identifierNames, mechanism: audit });

    expect(bindingsToRun({ waivedClauses: "not-run", records: [waiver], bindings: [auditNames, auditLength] })).toEqual([
      auditLength,
    ]);
  });

  it("runs every clause when waived clauses run", () => {
    const waiver = waiverOf({ clause: identifierNames, mechanism: audit });

    expect(bindingsToRun({ waivedClauses: "run", records: [waiver], bindings: [auditNames, auditLength] })).toEqual([
      auditNames,
      auditLength,
    ]);
  });

  it("leaves a waived clause of an embedded mechanism unrun while its sibling runs", () => {
    expect(
      bindingsToRun({ waivedClauses: "not-run", records: [namingWaiver], bindings: [eslintNaming, eslintLength] }),
    ).toEqual([eslintLength]);
  });
});

describe("notRunClauses", () => {
  it("names each selected binding that did not run, with its mechanism", () => {
    expect(notRunClauses({ bindings: [auditNames, eslintNaming], ran: [auditNames] })).toEqual([
      { clause: namingConvention, mechanism: eslint },
    ]);
  });

  it("is empty when every binding ran", () => {
    expect(notRunClauses({ bindings: [auditNames, eslintNaming], ran: [auditNames, eslintNaming] })).toEqual([]);
  });
});

describe("waivedClausesAssessmentOf", () => {
  it("is nothing when waived clauses run", () => {
    expect(waivedClausesAssessmentOf({ waivedClauses: "run", records: [namingWaiver], notRun: [] })).toEqual([]);
  });

  it("counts every record on a clause that did not run as not judged stale", () => {
    expect(
      waivedClausesAssessmentOf({
        waivedClauses: "not-run",
        records: [namingWaiver, namingCarveOut, waiverOf({ clause: functionLength, mechanism: eslint })],
        notRun: [{ clause: namingConvention, mechanism: eslint }],
      }),
    ).toEqual([
      {
        concern: "waivedClauses",
        assessedBy: "not-run",
        clausesNotRun: [{ clause: namingConvention, mechanism: eslint }],
        recordsNotJudgedStale: 2,
      },
    ]);
  });

  it("still reports the choice when no clause was left unrun", () => {
    expect(waivedClausesAssessmentOf({ waivedClauses: "not-run", records: [], notRun: [] })).toEqual([
      { concern: "waivedClauses", assessedBy: "not-run", clausesNotRun: [], recordsNotJudgedStale: 0 },
    ]);
  });
});
