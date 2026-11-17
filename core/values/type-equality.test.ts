import { describe, expect, it } from "vitest";
import type { Branded } from "./branded.ts";
import type { Equal, EqualIgnoringReadonly } from "./type-equality.ts";

describe("Equal", () => {
  it("is true for two identical object types", () => {
    const identical: Equal<
      { readonly name: string },
      { readonly name: string }
    > = true;
    expect(identical).toBe(true);
  });

  it("is false for a readonly array against a mutable one", () => {
    const readonlyArray: Equal<readonly string[], string[]> = false;
    expect(readonlyArray).toBe(false);
  });
});

describe("EqualIgnoringReadonly", () => {
  it("is true for nested objects and arrays that differ only in readonly", () => {
    const sameShape: EqualIgnoringReadonly<
      { readonly outer: { readonly lines: readonly number[] } },
      { outer: { lines: number[] } }
    > = true;
    expect(sameShape).toBe(true);
  });

  it("is false when a nested field's type differs", () => {
    const differentField: EqualIgnoringReadonly<{ readonly outer: { readonly line: number } }, { outer: { line: string } }> = false;
    expect(differentField).toBe(false);
  });

  it("is false when one side has an extra optional field", () => {
    const extraField: EqualIgnoringReadonly<{ readonly name: string; readonly note?: string }, { name: string }> = false;
    expect(extraField).toBe(false);
  });

  it("keeps a brand, so a plain string is not a branded one", () => {
    const branded: EqualIgnoringReadonly<{ readonly path: Branded<string, "Path"> }, { path: string }> = false;
    expect(branded).toBe(false);
  });
});
