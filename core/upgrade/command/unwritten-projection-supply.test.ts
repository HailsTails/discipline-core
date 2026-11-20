import { describe, expect, it } from "vitest";
import { unwrittenProjectionSupply } from "./unwritten-projection-supply.ts";

describe("unwrittenProjectionSupply", () => {
  it("names a placeholder path", () => {
    expect(unwrittenProjectionSupply.versionTwoProjection).toBe("hone.unwritten.mjs");
  });
});
