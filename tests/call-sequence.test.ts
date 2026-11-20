import { describe, expect, it, vi } from "vitest";
import { callSequenceOf } from "./call-sequence.ts";

describe("callSequenceOf", () => {
  it("lists the calls of every mock in the order they were made, each under its name", () => {
    const first = vi.fn<(request: { readonly path: string }) => void>();
    const second = vi.fn<(request: { readonly path: string }) => void>();
    first({ path: "a" });
    second({ path: "b" });
    first({ path: "c" });
    expect(callSequenceOf({ mocks: { first, second } })).toEqual([
      { port: "first", arguments: [{ path: "a" }] },
      { port: "second", arguments: [{ path: "b" }] },
      { port: "first", arguments: [{ path: "c" }] },
    ]);
  });

  it("lists nothing for mocks that were never called", () => {
    expect(callSequenceOf({ mocks: { idle: vi.fn<() => void>() } })).toEqual([]);
  });
});
