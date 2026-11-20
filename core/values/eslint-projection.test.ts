import { describe, expect, it } from "vitest";
import { eslintProjectionSchema } from "./eslint-projection.ts";

describe("eslintProjectionSchema", () => {
  it.each(["javascript", "typescript"])("accepts %s", (projection) => {
    expect(eslintProjectionSchema.safeParse(projection)).toEqual({ success: true, data: projection });
  });

  it.each(["mjs", "ts", "", "TypeScript"])("refuses %j", (projection) => {
    expect(eslintProjectionSchema.safeParse(projection).success).toBe(false);
  });
});
