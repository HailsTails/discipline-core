import { describe, expect, it } from "vitest";
import { gatheredOutcomes } from "./gathered-outcomes.ts";
import type { Result } from "./result.ts";

type Listed = Result<readonly number[], string>;

describe("gatheredOutcomes", () => {
  it("is an empty ok list for no outcomes", () => {
    expect(gatheredOutcomes<number, string>({ outcomes: [] })).toEqual({ outcome: "ok", value: [] });
  });

  it("concatenates ok lists in order", () => {
    const outcomes: readonly Listed[] = [
      { outcome: "ok", value: [1, 2] },
      { outcome: "ok", value: [] },
      { outcome: "ok", value: [3] },
    ];
    expect(gatheredOutcomes({ outcomes })).toEqual({ outcome: "ok", value: [1, 2, 3] });
  });

  it("is the first failure when several fail", () => {
    const outcomes: readonly Listed[] = [
      { outcome: "ok", value: [1] },
      { outcome: "failed", error: "first" },
      { outcome: "failed", error: "second" },
    ];
    expect(gatheredOutcomes({ outcomes })).toEqual({ outcome: "failed", error: "first" });
  });
});
