import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { CHECKS_PROJECTION_PATH, type ProjectedCheck, checksProjectionText } from "./checks-projection.ts";

const PACKAGE_IMPORT = "@hailstails/hone/eslint-plugin";

const SKIPPED_TESTS: ProjectedCheck = { symptom: "test-switched-off", ruleId: "hone/test-switched-off/skipped-tests", options: [] };

const FOCUSED_TESTS: ProjectedCheck = { symptom: "test-switched-off", ruleId: "hone/test-switched-off/focused-tests", options: [] };

const PARAMETER_COUNT: ProjectedCheck = {
  symptom: "positional-parameters",
  ruleId: "hone/positional-parameters/parameter-count",
  options: [{ max: 2, countVoidThis: true }],
};

const NON_NULL_ASSERTIONS: ProjectedCheck = { symptom: "claimed-type", ruleId: "hone/claimed-type/non-null-assertions", options: [] };

describe("CHECKS_PROJECTION_PATH", () => {
  it("is hone.eslint.mjs at the repository root", () => {
    expect(CHECKS_PROJECTION_PATH).toBe("hone.eslint.mjs");
  });
});

describe("checksProjectionText", () => {
  it("writes the plan's projection byte for byte", () => {
    expect(checksProjectionText({ pluginImport: PACKAGE_IMPORT, checks: [SKIPPED_TESTS], answered: [] })).toBe(
      'import hone from "@hailstails/hone/eslint-plugin";\nexport default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], plugins: { hone }, rules: { "hone/test-switched-off/skipped-tests": "error" } }];\n',
    );
  });

  it("enables every check's rule in code-unit order, with its options", () => {
    expect(checksProjectionText({ pluginImport: "./api/eslint-plugin.ts", checks: [SKIPPED_TESTS, PARAMETER_COUNT, FOCUSED_TESTS], answered: [] })).toBe(
      'import hone from "./api/eslint-plugin.ts";\nexport default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], plugins: { hone }, rules: { "hone/positional-parameters/parameter-count": ["error",{"max":2,"countVoidThis":true}], "hone/test-switched-off/focused-tests": "error", "hone/test-switched-off/skipped-tests": "error" } }];\n',
    );
  });

  it("switches off, on each answered file, every rule of the symptoms its records answer, one block per set of symptoms", () => {
    expect(
      checksProjectionText({
        pluginImport: PACKAGE_IMPORT,
        checks: [SKIPPED_TESTS, FOCUSED_TESTS, NON_NULL_ASSERTIONS],
        answered: [
          { symptom: "test-switched-off", file: repoPathSchema.parse("src/b.test.ts") },
          { symptom: "claimed-type", file: repoPathSchema.parse("src/c.ts") },
          { symptom: "test-switched-off", file: repoPathSchema.parse("src/c.ts") },
          { symptom: "test-switched-off", file: repoPathSchema.parse("src/a.test.ts") },
        ],
      }),
    ).toBe(
      `import hone from "@hailstails/hone/eslint-plugin";
export default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], plugins: { hone }, rules: { "hone/claimed-type/non-null-assertions": "error", "hone/test-switched-off/focused-tests": "error", "hone/test-switched-off/skipped-tests": "error" } },
{ name: "hone/answered/claimed-type, test-switched-off", files: ["src/c.ts"], rules: { "hone/claimed-type/non-null-assertions": "off", "hone/test-switched-off/focused-tests": "off", "hone/test-switched-off/skipped-tests": "off" } },
{ name: "hone/answered/test-switched-off", files: ["src/a.test.ts", "src/b.test.ts"], rules: { "hone/test-switched-off/focused-tests": "off", "hone/test-switched-off/skipped-tests": "off" } }];
`,
    );
  });

  it("escapes glob characters in an answered file's path", () => {
    expect(
      checksProjectionText({
        pluginImport: PACKAGE_IMPORT,
        checks: [NON_NULL_ASSERTIONS],
        answered: [{ symptom: "claimed-type", file: repoPathSchema.parse("app/[id]/page.ts") }],
      }),
    ).toContain('{ name: "hone/answered/claimed-type", files: ["app/\\\\[id\\\\]/page.ts"], rules: { "hone/claimed-type/non-null-assertions": "off" } }];');
  });

  it("writes no block for a record whose symptom has no check on ESLint", () => {
    expect(
      checksProjectionText({
        pluginImport: PACKAGE_IMPORT,
        checks: [SKIPPED_TESTS],
        answered: [{ symptom: "loop-keyword", file: repoPathSchema.parse("src/a.ts") }],
      }),
    ).toBe(
      'import hone from "@hailstails/hone/eslint-plugin";\nexport default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], plugins: { hone }, rules: { "hone/test-switched-off/skipped-tests": "error" } }];\n',
    );
  });

  it("writes an empty rule set when no check runs on ESLint", () => {
    expect(checksProjectionText({ pluginImport: PACKAGE_IMPORT, checks: [], answered: [] })).toBe(
      'import hone from "@hailstails/hone/eslint-plugin";\nexport default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], plugins: { hone }, rules: {} }];\n',
    );
  });
});
