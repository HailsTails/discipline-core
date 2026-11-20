import { describe, expect, it } from "vitest";
import { type NodeFeatures, type TypeStripping, typeStrippingOf } from "./type-stripping-port.ts";

describe("typeStrippingOf", () => {
  it.each<readonly [NodeFeatures["typescript"], TypeStripping]>([
    ["strip", "strips-types"],
    ["transform", "strips-types"],
    [false, "keeps-types"],
  ])("reads Node.js's typescript feature %s as %s", (typescript, stripping) => {
    expect(typeStrippingOf({ features: { typescript } })).toBe(stripping);
  });
});
