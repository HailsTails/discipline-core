import { describe, expect, it } from "vitest";
import type { Finding } from "../governance/governance.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { escapedLineBreaks, findingLine, locatedFindingLine } from "./finding-line.ts";

const FINDING: Finding = {
  clause: clauseAddressSchema.parse("CD-14#class-syntax"),
  mechanism: mechanismIdSchema.parse("audit"),
  file: repoPathSchema.parse("src/a.ts"),
  anchor: { line: 3, column: 5 },
  snippet: "class A {}",
};

const REMEDIED: Finding = { ...FINDING, remedy: { fix: "write a factory", page: "node_modules/@hailstails/hone/rules/CD-14/CHECKS.md", section: "a-class" } };

describe("escapedLineBreaks", () => {
  it("writes each line feed and carriage return as its escape", () => {
    expect(escapedLineBreaks({ text: "a\r\nb\nc" })).toBe(String.raw`a\r\nb\nc`);
  });
});

describe("locatedFindingLine", () => {
  it("renders clause, mechanism, file:line:column and snippet", () => {
    expect(locatedFindingLine({ finding: FINDING })).toBe("CD-14#class-syntax audit src/a.ts:3:5 class A {}");
  });

  it("leaves out the fix a piece names", () => {
    expect(locatedFindingLine({ finding: REMEDIED })).toBe("CD-14#class-syntax audit src/a.ts:3:5 class A {}");
  });
});

describe("findingLine", () => {
  it("renders a finding with no fix as its located line", () => {
    expect(findingLine({ finding: FINDING })).toBe("CD-14#class-syntax audit src/a.ts:3:5 class A {}");
  });

  it("renders the fix, then the page and section it is given, after the snippet", () => {
    expect(findingLine({ finding: REMEDIED })).toBe(
      "CD-14#class-syntax audit src/a.ts:3:5 class A {} fix: write a factory (node_modules/@hailstails/hone/rules/CD-14/CHECKS.md#a-class)",
    );
  });

  it("escapes a line break in the fix so the finding stays on one line", () => {
    expect(findingLine({ finding: { ...FINDING, remedy: { fix: "write\na factory", page: "rules/CD-14/CHECKS.md", section: "a-class" } } })).toBe(
      String.raw`CD-14#class-syntax audit src/a.ts:3:5 class A {} fix: write\na factory (rules/CD-14/CHECKS.md#a-class)`,
    );
  });
});
