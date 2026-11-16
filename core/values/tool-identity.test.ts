import { describe, expect, it } from "vitest";
import { TOOL_IDENTITY } from "./tool-identity.ts";

describe("TOOL_IDENTITY", () => {
  it("publishes the package honed, which installs the one command hone", () => {
    expect({ packageName: TOOL_IDENTITY.packageName, command: TOOL_IDENTITY.command }).toEqual({
      packageName: "honed",
      command: "hone",
    });
  });

  it("describes the package in one sentence", () => {
    expect(TOOL_IDENTITY.description).toMatch(/^[^.]+\.$/);
  });
});
