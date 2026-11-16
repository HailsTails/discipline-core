import { describe, expect, it } from "vitest";
import type { ToolchainRequirement } from "../core/mechanism-port/toolchain-requirement.ts";
import { TYPESCRIPT_REQUIREMENT } from "../mechanisms/audit/runner/typescript-parse.ts";
import { ESLINT_TOOLCHAIN_REQUIREMENTS } from "../mechanisms/eslint/runner/eslint-toolchain.ts";
import developmentManifest from "../package.json" with { type: "json" };
import { peerKindsOf } from "../scripts/published-manifest.ts";

const REQUIREMENTS: readonly ToolchainRequirement[] = [TYPESCRIPT_REQUIREMENT, ...ESLINT_TOOLCHAIN_REQUIREMENTS];

describe("the package manifest's peers", () => {
  it("requires typescript, which every audit clause needs, and leaves the ESLint toolchain optional", () => {
    expect(Object.fromEntries(REQUIREMENTS.map((requirement) => [requirement.packageName, requirement.peer]))).toEqual({
      typescript: "required",
      eslint: "optional",
      "@typescript-eslint/parser": "optional",
      "@typescript-eslint/eslint-plugin": "optional",
    });
  });

  it("declares each toolchain package as the kind of peer the mechanism that loads it says it is", () => {
    expect(peerKindsOf({ developmentManifest: JSON.stringify(developmentManifest) })).toEqual({
      outcome: "ok",
      value: Object.fromEntries(REQUIREMENTS.map((requirement) => [requirement.packageName, requirement.peer])),
    });
  });
});