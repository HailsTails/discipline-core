import { describe, expect, it } from "vitest";
import { ABSENT_ENTRY_KIND, EMPTY_DISK } from "./empty-walker-disk.ts";

describe("EMPTY_DISK", () => {
  it("holds no file under its root", () => {
    expect(EMPTY_DISK.kindAt({ path: "/repo/tsconfig.base.json" })).toBe("absent");
  });

  it("reads nothing", () => {
    expect(EMPTY_DISK.textAt({ path: "/repo/tsconfig.base.json" })).toEqual({
      outcome: "failed",
      error: { detail: "/repo/tsconfig.base.json is not a file" },
    });
  });

  it("is rooted at the repository the walker tests use", () => {
    expect(EMPTY_DISK.root).toBe("/repo");
  });
});

describe("ABSENT_ENTRY_KIND", () => {
  it("finds no entry at any path", () => {
    expect(ABSENT_ENTRY_KIND.kindOf({ path: "/repo/node_modules" })).toBe("absent");
  });
});
