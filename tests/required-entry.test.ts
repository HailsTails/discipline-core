import { describe, expect, it } from "vitest";
import { requiredEntry, requiredSegmentsEntry } from "./required-entry.ts";

const TABLE: Readonly<Record<string, string>> = { "/package": "/package/README.md" };

const SEGMENTS_TABLE: Readonly<Record<string, string>> = { '[".","mechanisms","eslint"]': "mechanisms/eslint" };

describe("requiredEntry", () => {
  it("returns the entry the table holds for the key", () => {
    expect(requiredEntry({ table: TABLE, key: "/package" })).toBe("/package/README.md");
  });

  it("fails naming the key when the table holds no entry for it", () => {
    expect(() => requiredEntry({ table: TABLE, key: "/scratch" })).toThrow("the fake table holds no entry for /scratch");
  });
});

describe("requiredSegmentsEntry", () => {
  it("returns the entry the table holds under the segments written as a JSON array", () => {
    expect(requiredSegmentsEntry({ table: SEGMENTS_TABLE, segments: [".", "mechanisms", "eslint"] })).toBe("mechanisms/eslint");
  });

  it("fails naming the segments when the table holds no entry for them", () => {
    expect(() => requiredSegmentsEntry({ table: SEGMENTS_TABLE, segments: [".", "rules"] })).toThrow(
      'the fake table holds no entry for [".","rules"]',
    );
  });
});
