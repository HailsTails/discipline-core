import { describe, expect, it } from "vitest";
import { packageFileStemOf, TOOL_IDENTITY } from "./tool-identity.ts";

describe("TOOL_IDENTITY", () => {
  it("names the tool Hone, publishes the scoped package @hailstails/hone, which installs the one command hone", () => {
    expect({ name: TOOL_IDENTITY.name, packageName: TOOL_IDENTITY.packageName, command: TOOL_IDENTITY.command }).toEqual({
      name: "Hone",
      packageName: "@hailstails/hone",
      command: "hone",
    });
  });

  it("keeps the ESLint namespace honed reserved in its own field, so renaming the package to @hailstails/hone left ESLint rule ids and projection block names alone", () => {
    expect(TOOL_IDENTITY.reservedEslintNamespace).toBe("honed");
  });

  it("names the GitHub repository the package is published from, and the npm name that belongs to an unrelated package", () => {
    expect({ repository: TOOL_IDENTITY.repository, unrelatedNpmPackage: TOOL_IDENTITY.unrelatedNpmPackage }).toEqual({
      repository: "https://github.com/HailsTails/hone",
      unrelatedNpmPackage: "hone",
    });
  });

  it.each([
    ["@hailstails/hone", "hailstails-hone"],
    ["honed", "honed"],
  ] as const)("files the package %s under the stem %s, the way npm pack names its tarball", (packageName, stem) => {
    expect(packageFileStemOf({ packageName })).toBe(stem);
  });

  it("describes the package in one sentence without narrowing the disciplines to code", () => {
    expect(TOOL_IDENTITY.description).not.toMatch(/coding/);
  });

  it("describes the package in one sentence", () => {
    expect(TOOL_IDENTITY.description).toMatch(/^[^.]+\.$/);
  });
});
