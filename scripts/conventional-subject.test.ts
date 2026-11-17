import { describe, expect, it } from "vitest";
import { changeEntryOf, conventionalSubjectOf } from "./conventional-subject.ts";

describe("conventionalSubjectOf", () => {
  it("reads a type and a description", () => {
    expect(conventionalSubjectOf({ subject: "feat: add a release script" })).toEqual({
      outcome: "ok",
      value: { type: "feat", scope: undefined, compatibility: "compatible", description: "add a release script" },
    });
  });

  it("reads a scope and the breaking marker", () => {
    expect(conventionalSubjectOf({ subject: "fix(eslint)!: rename the plugin namespace (#21)" })).toEqual({
      outcome: "ok",
      value: { type: "fix", scope: "eslint", compatibility: "breaking", description: "rename the plugin namespace (#21)" },
    });
  });

  it.each(["feat", "fix", "perf", "revert", "docs", "refactor", "test", "build", "ci", "chore", "style"])("accepts the type %s", (type) => {
    expect(conventionalSubjectOf({ subject: `${type}: change something` }).outcome).toBe("ok");
  });

  it("refuses a type outside the list", () => {
    expect(conventionalSubjectOf({ subject: "feature: add a release script" })).toEqual({
      outcome: "failed",
      error: { kind: "unknown-type", type: "feature" },
    });
  });

  it.each([
    "Keep versions out of the docs (#20)",
    "Feat: add a release script",
    "feat:add a release script",
    "feat: ",
    "feat:  add a release script",
    "feat(): add a release script",
    "feat(Eslint): add a release script",
  ])("refuses %j, which is not shaped type(scope)!: description", (subject) => {
    expect(conventionalSubjectOf({ subject })).toEqual({ outcome: "failed", error: { kind: "unshaped" } });
  });
});

describe("changeEntryOf", () => {
  it("keeps a conventional subject's parts", () => {
    expect(changeEntryOf({ subject: "docs: explain the policy" })).toEqual({
      kind: "conventional",
      subject: { type: "docs", scope: undefined, compatibility: "compatible", description: "explain the policy" },
    });
  });

  it("keeps any other subject whole, as unclassified", () => {
    expect(changeEntryOf({ subject: "Keep versions out of the docs (#20)" })).toEqual({
      kind: "unclassified",
      subject: "Keep versions out of the docs (#20)",
    });
  });
});
