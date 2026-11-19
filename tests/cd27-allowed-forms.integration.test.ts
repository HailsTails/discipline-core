import { assert, describe, expect, it } from "vitest";
import { checkConformance } from "../core/conformance/conformance.ts";
import { runnerModuleSchema } from "../core/mechanism-port/runner-module-schema.ts";
import { mechanismIdSchema } from "../core/values/identifiers.ts";
import * as walkerRunnerModule from "../mechanisms/audit/runner/runner.ts";
import { TEST_BODY_SECTIONS } from "../mechanisms/audit/CD-27/test-body-logic.ts";
import * as eslintRunnerModule from "../mechanisms/eslint/runner/runner.ts";
import { allowedFormSectionsOf } from "./allowed-forms-page.ts";
import {
  allowCasesOf,
  allowedBlocksOf,
  cd27ChecksPageOf,
  remedySectionsOf,
  repositoryRootOf,
  rowsNamed,
  sectionNamesOf,
  typeErrorsOf,
} from "./allowed-forms-proof.ts";
import { conformanceRows, foldersUnder } from "./conformance-rows.ts";
import { defaultParsePort } from "./typescript-parse-port.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const REPO_ROOT = repositoryRootOf({ testFolder: import.meta.dirname });

const ruleSetTexts = import.meta.glob(
  ["./rules/*/discipline.json", "./mechanisms/audit/*/piece.json", "./mechanisms/eslint/*/piece.json"],
  { base: "../", query: "?raw", import: "default", eager: true },
);

const AUDIT_ROWS = rowsNamed({
  rows: conformanceRows({
    table: ruleSetTexts,
    disciplines: foldersUnder({ table: ruleSetTexts, prefix: "./mechanisms/audit/" }),
    mechanism: mechanismIdSchema.parse("audit"),
    mechanismRoot: `${REPO_ROOT}/mechanisms/audit`,
  }),
  names: ["CD-1#any-cast", "CD-2#cast-expressions", "CD-14#class-syntax", "CD-15#loops", "CD-27#test-body-logic", "CD-27#test-body-logic edition 2"],
});

const ESLINT_ROWS = rowsNamed({
  rows: conformanceRows({
    table: ruleSetTexts,
    disciplines: foldersUnder({ table: ruleSetTexts, prefix: "./mechanisms/eslint/" }),
    mechanism: mechanismIdSchema.parse("eslint"),
    mechanismRoot: `${REPO_ROOT}/mechanisms/eslint`,
  }),
  names: ["CD-1#explicit-any", "CD-1#implicit-any-let", "CD-2#non-null-assertions", "CD-14#class-syntax", "CD-14#static-only-class"],
});

const SECTIONS = allowedFormSectionsOf({ page: cd27ChecksPageOf({ repoRoot: REPO_ROOT }) });

const BLOCKS = allowedBlocksOf({ sections: SECTIONS });

const ALLOW_CASES = allowCasesOf({ blocks: BLOCKS });

const walkerRunner = runnerModuleSchema.parse(walkerRunnerModule.runner);

const eslintRunner = runnerModuleSchema.parse(eslintRunnerModule.runner);

describe("rules/CD-27/CHECKS.md, Allowed forms in a test", () => {
  it("has one section for each fix a CD-27#test-body-logic finding names, in the same order", () => {
    expect(sectionNamesOf({ sections: SECTIONS })).toEqual(TEST_BODY_SECTIONS);
  });

  it("selects every audit and ESLint clause the forms are held to", () => {
    expect(AUDIT_ROWS).toHaveLength(6);
    expect(ESLINT_ROWS).toHaveLength(5);
  });

  it.each(SECTIONS)("shows under $heading a flagged form whose finding names that section", async ({ flagged, section }) => {
    const [secondEditionRow] = rowsNamed({ rows: AUDIT_ROWS, names: ["CD-27#test-body-logic edition 2"] });
    assert.isDefined(secondEditionRow);

    expect(await remedySectionsOf({ repoRoot: REPO_ROOT, parse: defaultParsePort, clause: secondEditionRow.clause, source: flagged })).toContain(section);
  });

  it.each(BLOCKS)("compiles $name under the compiler options CD-3 requires", ({ source }) => {
    expect(typeErrorsOf({ syntaxApi: defaultParsePort.syntaxApi, repoRoot: REPO_ROOT, source })).toEqual([]);
  });

  it.each(AUDIT_ROWS)("has no form to write instead that the audit runner flags under $name", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: ALLOW_CASES, runner: walkerRunner })).toEqual({ outcome: "ok", value: [] });
  });

  it.each(ESLINT_ROWS)("has no form to write instead that the ESLint runner flags under $name", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: ALLOW_CASES, runner: eslintRunner })).toEqual({ outcome: "ok", value: [] });
  });
});
