import { describe, expect, it } from "vitest";
import { projectionDeclarationKeyIn, ROOT_PROJECTION_DECLARATION_KEY, withoutProjectionOutputs } from "./without-projection-outputs.ts";

describe("ROOT_PROJECTION_DECLARATION_KEY", () => {
  it("is the repository-relative key a root declaration is loaded under", () => {
    expect(ROOT_PROJECTION_DECLARATION_KEY).toBe("./hone.eslint.d.mts");
  });
});

describe("projectionDeclarationKeyIn", () => {
  it("is the key a declaration of that name is loaded under in a folder", () => {
    expect(projectionDeclarationKeyIn({ folder: "packages/web" })).toBe("./packages/web/hone.eslint.d.mts");
  });
});

describe("withoutProjectionOutputs", () => {
  it("drops the configuration and the declaration this repository's projection writes at its root, and keeps every other file, a file of the same name elsewhere included", () => {
    expect(
      withoutProjectionOutputs({
        sources: {
          "./hone.eslint.mjs": "export default [];\n",
          "./hone.eslint.d.mts": "export default projection;\n",
          "./packages/web/hone.eslint.d.mts": "export default authored;\n",
          "./mechanisms/eslint/runner/hone.eslint.mjs": "export default authored;\n",
          "./eslint.config.mjs": "export default [];\n",
        },
      }),
    ).toEqual({
      "./packages/web/hone.eslint.d.mts": "export default authored;\n",
      "./mechanisms/eslint/runner/hone.eslint.mjs": "export default authored;\n",
      "./eslint.config.mjs": "export default [];\n",
    });
  });
});
