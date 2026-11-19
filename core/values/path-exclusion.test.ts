import { describe, expect, it } from "vitest";
import { pathExclusionOf } from "./path-exclusion.ts";
import { repoPathSchema } from "./repo-path.ts";

const VENDOR = repoPathSchema.parse("vendor");
const GENERATED = repoPathSchema.parse("src/generated.ts");

describe("pathExclusionOf", () => {
  it("excludes the exact file listed", () => {
    expect(pathExclusionOf({ path: GENERATED, excluded: [GENERATED] })).toBe("excluded");
  });

  it("excludes a path under a listed folder", () => {
    expect(pathExclusionOf({ path: repoPathSchema.parse("vendor/lib.ts"), excluded: [VENDOR] })).toBe("excluded");
  });

  it("checks a path that only shares a name prefix with a listed folder", () => {
    expect(pathExclusionOf({ path: repoPathSchema.parse("vendored/kept.ts"), excluded: [VENDOR] })).toBe("checked");
  });

  it("checks every path when nothing is excluded", () => {
    expect(pathExclusionOf({ path: GENERATED, excluded: [] })).toBe("checked");
  });
});
