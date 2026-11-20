import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { configuredDirectoriesOf, packageConfigRootCountOf } from "./checks-config-roots.ts";

const TRACKED = [
  repoPathSchema.parse("eslint.config.mjs"),
  repoPathSchema.parse("package.json"),
  repoPathSchema.parse("packages/a/eslint.config.js"),
  repoPathSchema.parse("packages/a/src/a.ts"),
  repoPathSchema.parse("packages/b/tools/eslint.config.ts"),
];

const PACKAGE_A = repoPathSchema.parse("packages/a");

const PACKAGE_C = repoPathSchema.parse("packages/c");

describe("configuredDirectoriesOf", () => {
  it("names every directory holding an ESLint config, the repository root as an empty name, when each file looks up its nearest config", () => {
    expect(configuredDirectoriesOf({ trackedPaths: TRACKED, lookup: "nearest-to-file" })).toEqual(["", "packages/a", "packages/b/tools"]);
  });

  it("names none when only the repository root's config is looked up", () => {
    expect(configuredDirectoriesOf({ trackedPaths: TRACKED, lookup: "repository-root" })).toEqual([]);
  });
});

describe("packageConfigRootCountOf", () => {
  it("counts the configured directories below the repository root", () => {
    expect(packageConfigRootCountOf({ trackedPaths: TRACKED, declared: [], lookup: "nearest-to-file" })).toBe(2);
  });

  it("counts none for a root-only lookup", () => {
    expect(packageConfigRootCountOf({ trackedPaths: TRACKED, declared: [], lookup: "repository-root" })).toBe(0);
  });

  it("counts a declared directory once when it is also configured, and once more when it is not", () => {
    expect(packageConfigRootCountOf({ trackedPaths: TRACKED, declared: [PACKAGE_A, PACKAGE_C], lookup: "nearest-to-file" })).toBe(3);
  });
});
