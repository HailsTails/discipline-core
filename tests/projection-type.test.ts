import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../core/values/repo-path.ts";
import { checksDeclarationText, checksProjectionText } from "../mechanisms/eslint/runner/checks-projection.ts";
import { type ConsumerFiles, consumerDiagnosticsOn, ESLINT_LINES } from "./consumer-typing.ts";

const PLUGIN_SPECIFIER = "@hailstails/hone/eslint-plugin";

const CHECKS = [
  { symptom: "S-1", check: "C-1", ruleId: "hone/S-1-C-1", options: [{ maximum: 3 }] },
  { symptom: "S-2", check: "C-2", ruleId: "hone/S-2-C-2", options: [] },
];

const ROOT_PROJECTION = checksProjectionText({
  pluginImport: PLUGIN_SPECIFIER,
  checks: CHECKS,
  answered: [{ symptom: "S-1", check: "C-1", file: repoPathSchema.parse("src/old.ts") }],
});

const PACKAGE_PROJECTION = checksProjectionText({ pluginImport: PLUGIN_SPECIFIER, checks: CHECKS, answered: [] });

const CONFIG_API = "eslint/config";

const ROOT_CONFIG = `import { defineConfig } from "${CONFIG_API}";
import hone from "./hone.eslint.mjs";

export default defineConfig([...hone, { files: ["**/*.ts"], rules: {} }]);
`;

const PACKAGE_CONFIG = `import { defineConfig } from "${CONFIG_API}";
import root from "../../hone.eslint.mjs";
import slice from "./hone.eslint.mjs";

export default defineConfig([...root, ...slice, { files: ["**/*.ts"], rules: {} }]);
`;

const declaredFiles = (request: { readonly entry: string; readonly entryText: string }): ConsumerFiles => ({
  [request.entry]: request.entryText,
  "hone.eslint.mjs": ROOT_PROJECTION,
  "hone.eslint.d.mts": checksDeclarationText(),
  "packages/a/hone.eslint.mjs": PACKAGE_PROJECTION,
  "packages/a/hone.eslint.d.mts": checksDeclarationText(),
});

const undeclaredFiles = (request: { readonly entry: string; readonly entryText: string }): ConsumerFiles => ({
  [request.entry]: request.entryText,
  "hone.eslint.mjs": ROOT_PROJECTION,
  "packages/a/hone.eslint.mjs": PACKAGE_PROJECTION,
});

describe("a typed ESLint config importing a version 2 projection, compiled in memory under strict with skipLibCheck off (CD-47: nothing is spawned or written)", () => {
  describe.each(ESLINT_LINES)("with the declaration written beside each projection, on %s", (line) => {
    it("compiles a .ts config for the root projection", () => {
      expect(consumerDiagnosticsOn({ line, form: "typescript", entry: "eslint.config.ts", files: declaredFiles({ entry: "eslint.config.ts", entryText: ROOT_CONFIG }) })).toEqual([]);
    });

    it("compiles a .ts config for a package slice over the root projection", () => {
      expect(
        consumerDiagnosticsOn({ line, form: "typescript", entry: "packages/a/eslint.config.ts", files: declaredFiles({ entry: "packages/a/eslint.config.ts", entryText: PACKAGE_CONFIG }) }),
      ).toEqual([]);
    });

    it("compiles a checked .mjs config for the root projection", () => {
      expect(consumerDiagnosticsOn({ line, form: "checked-javascript", entry: "eslint.config.mjs", files: declaredFiles({ entry: "eslint.config.mjs", entryText: ROOT_CONFIG }) })).toEqual([]);
    });

    it("compiles a checked .mjs config for a package slice over the root projection", () => {
      expect(
        consumerDiagnosticsOn({
          line,
          form: "checked-javascript",
          entry: "packages/a/eslint.config.mjs",
          files: declaredFiles({ entry: "packages/a/eslint.config.mjs", entryText: PACKAGE_CONFIG }),
        }),
      ).toEqual([]);
    });
  });

  describe.each(ESLINT_LINES)("without the declaration, on %s", (line) => {
    it("leaves a .ts config importing a projection with no type to import", () => {
      expect(consumerDiagnosticsOn({ line, form: "typescript", entry: "eslint.config.ts", files: undeclaredFiles({ entry: "eslint.config.ts", entryText: ROOT_CONFIG }) })).toEqual([
        expect.stringContaining("Could not find a declaration file for module './hone.eslint.mjs'"),
      ]);
    });

    it("leaves a checked .mjs config importing a projection typed as a union of the shapes its blocks happen to have", () => {
      expect(
        consumerDiagnosticsOn({ line, form: "checked-javascript", entry: "eslint.config.mjs", files: undeclaredFiles({ entry: "eslint.config.mjs", entryText: ROOT_CONFIG }) }),
      ).toEqual([expect.stringContaining("is not assignable to type"), expect.stringContaining("is not assignable to type")]);
    });
  });
});
