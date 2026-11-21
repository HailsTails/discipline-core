import { describe, expect, it } from "vitest";
import { consumerDiagnosticsOn, ESLINT_LINES, RESOLUTIONS, shippedDeclarationDiagnostics } from "./consumer-typing.ts";

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

describe("consumerDiagnosticsOn, compiling a consumer in memory against the node_modules/eslint of one ESLint line", () => {
  it("has the shipped plugin declarations compile on their own", () => {
    expect(shippedDeclarationDiagnostics).toEqual([]);
  });

  describe.each(ESLINT_LINES)("on %s", (line) => {
    describe.each(RESOLUTIONS)("under %s resolution", (resolution) => {
      it("finds nothing in a config typed by ESLint's own types", () => {
        expect(consumerDiagnosticsOn({ line, resolution, form: "typescript", entry: "eslint.config.ts", files: { "eslint.config.ts": WELL_TYPED } })).toEqual([]);
      });

      it("gives the file, code and message of what ESLint's types reject", () => {
        expect(consumerDiagnosticsOn({ line, resolution, form: "typescript", entry: "blocks.ts", files: { "blocks.ts": MISTYPED } })).toEqual([
          { file: "blocks.ts", code: 2322, message: "Type 'string' is not assignable to type '(string | string[])[]'." },
        ]);
      });
    });
  });
});
