import { configDefaults, defineConfig } from "vitest/config";
import { TOOL_IDENTITY } from "./core/values/tool-identity.ts";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ["**/*.test.ts"],
    exclude: [...configDefaults.exclude, "**/test-fixtures/**"],
    name: TOOL_IDENTITY.packageName,
    testTimeout: 30_000,
  },
});
