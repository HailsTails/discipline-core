import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../values/repo-path.ts";
import { misnamedLine } from "./misnamed-lines.ts";

const FILE = repoPathSchema.parse("src/a.ts");

describe("misnamedLine", () => {
  it("gives the file and line, the kind, the rule id the disable names and the comment", () => {
    expect(
      misnamedLine({
        misnamed: { kind: "version-1-id", ruleId: "hone/no-class-authoring", file: FILE, line: 2, text: "// eslint-disable-next-line hone/no-class-authoring" },
      }),
    ).toBe("src/a.ts:2 version-1-id hone/no-class-authoring // eslint-disable-next-line hone/no-class-authoring");
  });

  it("keeps a block comment that spans lines on one line", () => {
    expect(
      misnamedLine({
        misnamed: { kind: "names-no-check", ruleId: "hone/untyped-value/no-such-check", file: FILE, line: 5, text: "/* eslint-disable\nhone/untyped-value/no-such-check */" },
      }),
    ).toBe("src/a.ts:5 names-no-check hone/untyped-value/no-such-check /* eslint-disable\\nhone/untyped-value/no-such-check */");
  });
});
