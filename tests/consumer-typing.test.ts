import { describe, expect, it } from "vitest";
import { consumerDiagnosticsOn, ESLINT_LINES, shippedDeclarationDiagnostics } from "./consumer-typing.ts";

const ESLINT_PACKAGE = "eslint";

const CONFIG_API = "eslint/config";

const WELL_TYPED = `import type { Linter } from "${ESLINT_PACKAGE}";
import { defineConfig } from "${CONFIG_API}";

const blocks: Linter.Config[] = [{ files: ["**/*.ts"], rules: { "no-debugger": "error" } }];

export default defineConfig(blocks);
`;

const MISTYPED = `import type { Linter } from "${ESLINT_PACKAGE}";

export const blocks: Linter.Config[] = [{ files: "**/*.ts" }];
`;

describe("consumerDiagnosticsOn, compiling a consumer in memory against one ESLint line's own types", () => {
  it("has the shipped plugin declarations compile on their own", () => {
    expect(shippedDeclarationDiagnostics).toEqual([]);
  });

  it.each(ESLINT_LINES)("finds nothing in a config typed by ESLint's own types on %s", (line) => {
    expect(consumerDiagnosticsOn({ line, form: "typescript", entry: "eslint.config.ts", files: { "eslint.config.ts": WELL_TYPED } })).toEqual([]);
  });

  it.each(ESLINT_LINES)("names the first line of each diagnostic for a config ESLint's types reject on %s", (line) => {
    expect(consumerDiagnosticsOn({ line, form: "typescript", entry: "blocks.ts", files: { "blocks.ts": MISTYPED } })).toEqual([
      expect.stringContaining("is not assignable to type"),
    ]);
  });
});
