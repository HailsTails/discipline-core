import { describe, expect, it, vi } from "vitest";
import { LOOPS_CLAUSE, SETTINGS_CATALOGUE } from "../../../tests/settings-catalogue.ts";
import type { Finding, GovernedRun } from "../../governance/governance.ts";
import { mechanismIdSchema } from "../../values/identifiers.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import type { ExceptionRecord } from "../version-one-records/exception-record.ts";
import { createAnsweringOracle, type EnginePass } from "./answering-oracle.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const SRC_A = repoPathSchema.parse("src/a.ts");

const [LOOP_KEYWORD_LOOPS] = SETTINGS_CATALOGUE.checks;

const CARVE_OUT: ExceptionRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" };

const LOOP_FINDING: Finding = {
  clause: LOOPS_CLAUSE,
  file: SRC_A,
  anchor: { line: 3, column: 1 },
  snippet: "the loop line",
  mechanism: AUDIT,
  check: "loop-keyword#loops",
};

const QUIET_RUN: GovernedRun = { mechanism: AUDIT, nativeExceptions: [], coverableKinds: [] };

const SUPPRESSING_RUN: GovernedRun = {
  mechanism: AUDIT,
  nativeExceptions: [{ kind: "inline-disable", clause: LOOPS_CLAUSE, file: SRC_A, line: 3, text: "eslint-disable-next-line", reach: "one-clause" }],
  coverableKinds: ["inline-disable"],
};

const oracleOver = (request: { readonly pass: Awaited<ReturnType<EnginePass["findingsFor"]>> }) => {
  const enginePass: EnginePass = { findingsFor: vi.fn<EnginePass["findingsFor"]>().mockResolvedValue(request.pass) };
  return { enginePass, oracle: createAnsweringOracle({ enginePass, catalogue: { checks: SETTINGS_CATALOGUE.checks } }) };
};

describe("createAnsweringOracle", () => {
  it("credits a carve-out with the check of a finding the version 1 answerer let it exempt", async () => {
    const { oracle } = oracleOver({ pass: { outcome: "ok", value: { findings: [LOOP_FINDING], runs: [QUIET_RUN] } } });
    expect(await oracle.answer({ records: [CARVE_OUT] })).toEqual({
      outcome: "ok",
      value: [{ record: CARVE_OUT, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } }],
    });
  });

  it("answers nothing for a carve-out no finding and no suppression reached", async () => {
    const { oracle } = oracleOver({ pass: { outcome: "ok", value: { findings: [], runs: [QUIET_RUN] } } });
    expect(await oracle.answer({ records: [CARVE_OUT] })).toEqual({ outcome: "ok", value: [{ record: CARVE_OUT, answer: { credit: "nothing" } }] });
  });

  it("answers suppression-only for a carve-out only a native suppression at its clause and file reached", async () => {
    const { oracle } = oracleOver({ pass: { outcome: "ok", value: { findings: [], runs: [SUPPRESSING_RUN] } } });
    expect(await oracle.answer({ records: [CARVE_OUT] })).toEqual({
      outcome: "ok",
      value: [{ record: CARVE_OUT, answer: { credit: "suppression-only" } }],
    });
  });

  it("asks the engine pass for the findings with every record the file holds", async () => {
    const authorised: ExceptionRecord = { kind: "authorised-location", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: repoPathSchema.parse("src/b.ts"), reason: "kept" };
    const { oracle, enginePass } = oracleOver({ pass: { outcome: "ok", value: { findings: [], runs: [QUIET_RUN] } } });
    await oracle.answer({ records: [authorised, CARVE_OUT] });
    expect(enginePass.findingsFor).toHaveBeenCalledWith({ records: [authorised, CARVE_OUT] });
  });

  it("fails as the engine pass did when it could not run", async () => {
    const { oracle } = oracleOver({ pass: { outcome: "failed", error: { kind: "version-one-run-failed", detail: "the eslint runner threw" } } });
    expect(await oracle.answer({ records: [CARVE_OUT] })).toEqual({ outcome: "failed", error: { kind: "version-one-run-failed", detail: "the eslint runner threw" } });
  });
});
