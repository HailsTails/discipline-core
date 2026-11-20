import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import type { EslintConfigLookup } from "../../../core/values/eslint-config-lookup.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { boundaryNearestOnFlag, boundarySelectingLookup } from "../../../tests/eslint-major-boundary-stub.ts";
import { overlaidFileText } from "../../../tests/overlaid-file-text.ts";
import { configLookupDeclaring, teamConfigLookupFor } from "./config-lookup.ts";
import type { EslintMajorBoundary } from "./eslint-major-boundary.ts";

const REPO = absolutePathSchema.parse("/repo");

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" });

const NEAREST = { outcome: "ok", value: { kind: "nearest-to-file" } };

const ROOT = { outcome: "ok", value: { kind: "repository-root", configFile: "/repo/eslint.config.mjs" } };

const ROOT_CONFIG = { "/repo/eslint.config.mjs": "" };

const SELECTS_NEAREST = boundarySelectingLookup({ lookup: "nearest-to-file" });

const SELECTS_ROOT = boundarySelectingLookup({ lookup: "repository-root" });

const NEAREST_ON_FLAG = boundaryNearestOnFlag({ flag: "a-lookup-flag" });

const noFiles: FileTextPort = {
  read: ({ path: requested }) => ({ outcome: "failed", error: { kind: "unreadable", path: requested, detail: "absent" } }),
  exists: () => "absent",
  write: vi.fn<FileTextPort["write"]>(),
};

const ESLINT_INSTALLED = { "/repo/node_modules/eslint/package.json": '{ "version": "1.0.0" }' };

const lintScript = (request: { readonly command: string }) => ({
  "/repo/package.json": `{ "scripts": { "lint": "${request.command}" } }`,
});

const lookupDeclaring = (request: {
  readonly files: Readonly<Record<string, string>>;
  readonly boundary: EslintMajorBoundary;
  readonly declared: EslintConfigLookup | undefined;
}) => {
  const lookupRequest = {
    fileText: overlaidFileText({ base: noFiles, files: request.files }),
    path,
    repoRoot: REPO,
    trackedPaths: [repoPathSchema.parse("package.json")],
    boundary: request.boundary,
  };
  return teamConfigLookupFor({
    ...lookupRequest,
    settingsFile: "hone.config.json",
    lookup: configLookupDeclaring({ ...lookupRequest, declared: request.declared }),
  });
};

describe("teamConfigLookupFor", () => {
  it("names the settings file it was given when the repository root has no config for a root-only lookup", () => {
    expect(lookupDeclaring({ files: ESLINT_INSTALLED, boundary: SELECTS_ROOT, declared: undefined })).toEqual({
      outcome: "failed",
      error: {
        kind: "team-config-unloadable",
        detail:
          "the repository root has no eslint.config.* for a root-only config lookup; add one there, or set eslintConfigLookup to nearest-to-file in hone.config.json if ESLint runs from each package",
      },
    });
  });

  it("looks configs up nearest to each file when the boundary says its ESLint does by default", () => {
    expect(lookupDeclaring({ files: { ...ESLINT_INSTALLED, ...ROOT_CONFIG }, boundary: SELECTS_NEAREST, declared: undefined })).toEqual(NEAREST);
  });

  it.each([
    { name: "an ESLint that is not installed at the repository root", files: ROOT_CONFIG },
    { name: "an ESLint whose package file at the repository root names no version", files: { ...ROOT_CONFIG, "/repo/node_modules/eslint/package.json": "{}" } },
  ])("looks configs up nearest to each file for $name, whatever the boundary selects", ({ files }) => {
    expect(lookupDeclaring({ files, boundary: SELECTS_ROOT, declared: undefined })).toEqual(NEAREST);
  });

  it.each([
    { name: "--flag a-lookup-flag", command: "eslint --flag a-lookup-flag ." },
    { name: "--flag=a-lookup-flag", command: "eslint --flag=a-lookup-flag ." },
  ])("hands the flags the lint scripts name to the boundary, which selects the nearest lookup for $name", ({ command }) => {
    expect(
      lookupDeclaring({ files: { ...ESLINT_INSTALLED, ...lintScript({ command }), ...ROOT_CONFIG }, boundary: NEAREST_ON_FLAG, declared: undefined }),
    ).toEqual(NEAREST);
  });

  it("looks only at the root config when the boundary finds no lookup flag in the lint scripts", () => {
    expect(
      lookupDeclaring({ files: { ...ESLINT_INSTALLED, ...lintScript({ command: "eslint ." }), ...ROOT_CONFIG }, boundary: NEAREST_ON_FLAG, declared: undefined }),
    ).toEqual(ROOT);
  });

  it("lets a declared nearest-to-file win over what the boundary selects", () => {
    expect(lookupDeclaring({ files: ROOT_CONFIG, boundary: SELECTS_ROOT, declared: "nearest-to-file" })).toEqual(NEAREST);
  });

  it("lets a declared repository-root win over what the boundary selects", () => {
    expect(lookupDeclaring({ files: ROOT_CONFIG, boundary: SELECTS_NEAREST, declared: "repository-root" })).toEqual(ROOT);
  });
});
