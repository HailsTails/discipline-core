import { describe, expect, it } from "vitest";
import { TOOL_IDENTITY } from "./tool-identity.ts";

describe("TOOL_IDENTITY", () => {
  it("names the tool Hone, publishes the package honed, which installs the one command hone", () => {
    expect({ name: TOOL_IDENTITY.name, packageName: TOOL_IDENTITY.packageName, command: TOOL_IDENTITY.command }).toEqual({
      name: "Hone",
      packageName: "honed",
      command: "hone",
    });
  });

  it("reserves the ESLint namespace honed in its own field, so renaming the package leaves ESLint behaviour alone", () => {
    expect(TOOL_IDENTITY.reservedEslintNamespace).toBe("honed");
  });

  it("describes the package in one sentence", () => {
    expect(TOOL_IDENTITY.description).toMatch(/^[^.]+\.$/);
  });
});
