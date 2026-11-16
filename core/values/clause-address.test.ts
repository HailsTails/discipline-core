import { describe, expect, it } from "vitest";
import {
  clauseAddressSchema,
  clauseAddressText,
  sameClauseAddress,
} from "./clause-address.ts";

describe("clauseAddressSchema", () => {
  it("reads a text with no rule-set prefix as the shared rule set", () => {
    expect(clauseAddressSchema.parse("CD-14#no-class-syntax")).toEqual({
      ruleSet: "shared",
      discipline: "CD-14",
      clause: "no-class-syntax",
    });
  });

  it("reads a prefixed text as that named rule set", () => {
    expect(clauseAddressSchema.parse("probe/PD-1#no-tmp-files")).toEqual({
      ruleSet: { name: "probe" },
      discipline: "PD-1",
      clause: "no-tmp-files",
    });
  });

  it.each([
    "",
    "CD-14",
    "CD-14#",
    "#no-class-syntax",
    "cd-14#no-class-syntax",
    "CD-14#No-class",
    "CD-14#no-class#syntax",
    "CD-14 #no-class-syntax",
    "/CD-14#no-class-syntax",
    "Probe/CD-14#no-class-syntax",
    "probe/team/CD-14#no-class-syntax",
    "probe//CD-14#no-class-syntax",
    "shared/CD-14#no-class-syntax",
  ])("refuses %j", (text) => {
    expect(clauseAddressSchema.safeParse(text).success).toBe(false);
  });

  it("refuses a value that is not text", () => {
    expect(
      clauseAddressSchema.safeParse({
        ruleSet: "shared",
        discipline: "CD-14",
        clause: "no-class-syntax",
      }).success,
    ).toBe(false);
  });
});

describe("clauseAddressText", () => {
  it.each(["CD-14#no-class-syntax", "probe/PD-1#no-tmp-files"])(
    "formats the address read from %j back to the same text",
    (text) => {
      expect(
        clauseAddressText({ address: clauseAddressSchema.parse(text) }),
      ).toBe(text);
    },
  );
});

describe("sameClauseAddress", () => {
  it.each(["CD-14#no-class-syntax", "probe/PD-1#no-tmp-files"])(
    "is same for two separately read addresses of %j",
    (text) => {
      expect(
        sameClauseAddress({
          left: clauseAddressSchema.parse(text),
          right: clauseAddressSchema.parse(text),
        }),
      ).toBe("same");
    },
  );

  it.each([
    { part: "rule set", left: "CD-14#no-class-syntax", right: "probe/CD-14#no-class-syntax" },
    { part: "rule-set name", left: "probe/CD-14#no-class-syntax", right: "team/CD-14#no-class-syntax" },
    { part: "discipline", left: "CD-14#no-class-syntax", right: "CD-15#no-class-syntax" },
    { part: "clause", left: "CD-14#no-class-syntax", right: "CD-14#no-class-keyword" },
  ])("is different when the $part differs", ({ left, right }) => {
    expect(
      sameClauseAddress({
        left: clauseAddressSchema.parse(left),
        right: clauseAddressSchema.parse(right),
      }),
    ).toBe("different");
  });
});
