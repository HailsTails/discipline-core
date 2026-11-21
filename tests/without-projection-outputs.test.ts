import { describe, expect, it } from "vitest";
import { withoutProjectionOutputs } from "./without-projection-outputs.ts";

describe("withoutProjectionOutputs", () => {
  it("drops the configuration and the declaration hone project writes, at the root and in a package, and keeps every authored file", () => {
    expect(
      withoutProjectionOutputs({
        sources: {
          "./hone.eslint.mjs": "export default [];\n",
          "./hone.eslint.d.mts": "export default projection;\n",
          "./packages/web/hone.eslint.d.mts": "export default projection;\n",
          "./eslint.config.mjs": "export default [];\n",
          "./core/values/projection-outputs.ts": "export const kept = 1;\n",
        },
      }),
    ).toEqual({
      "./eslint.config.mjs": "export default [];\n",
      "./core/values/projection-outputs.ts": "export const kept = 1;\n",
    });
  });
});
