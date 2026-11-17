import { describe, expect, it } from "vitest";
import { deadLinksOf, misplacedEntriesOf, unbundledImportsOf, unlockedPackagesOf, versionMentionsOf } from "./package-guards.ts";
import type { LockedPackage } from "./pnpm-lock.ts";

const output = (request: {
  readonly path: string;
  readonly entryPoint?: string;
  readonly inputs?: readonly string[];
  readonly externalImports?: readonly string[];
}) => ({
  path: request.path,
  text: "",
  entryPoint: request.entryPoint,
  inputs: request.inputs ?? [],
  externalImports: request.externalImports ?? [],
});

describe("unbundledImportsOf", () => {
  it("accepts imports of node: builtins, of each peer and of each peer's subpaths", () => {
    expect(
      unbundledImportsOf({
        outputs: [
          output({
            path: "chunks/chunk-A.js",
            externalImports: ["node:fs", "eslint", "eslint/use-at-your-own-risk", "@typescript-eslint/eslint-plugin", "typescript"],
          }),
        ],
        peers: ["eslint", "@typescript-eslint/eslint-plugin", "typescript"],
      }),
    ).toEqual([]);
  });

  it("names each output that imports a package it neither bundles nor declares as a peer, and a bare builtin", () => {
    expect(
      unbundledImportsOf({
        outputs: [
          output({ path: "chunks/chunk-A.js", externalImports: ["levn", "eslint"] }),
          output({ path: "core/check/tool-command.js", externalImports: ["fs", "@eslint/plugin-kit", "eslint-plugin-x"] }),
        ],
        peers: ["eslint"],
      }),
    ).toEqual([
      "chunks/chunk-A.js imports levn",
      "core/check/tool-command.js imports fs",
      "core/check/tool-command.js imports @eslint/plugin-kit",
      "core/check/tool-command.js imports eslint-plugin-x",
    ]);
  });
});

describe("misplacedEntriesOf", () => {
  it("accepts entries emitted at their own path holding their own code", () => {
    expect(
      misplacedEntriesOf({
        entryPoints: ["mechanisms/eslint/runner/runner.ts"],
        outputs: [
          output({
            path: "mechanisms/eslint/runner/runner.js",
            entryPoint: "mechanisms/eslint/runner/runner.ts",
            inputs: ["mechanisms/eslint/runner/runner.ts"],
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("names an entry whose code another entry pulled into a shared chunk, and an entry with no output at its path", () => {
    expect(
      misplacedEntriesOf({
        entryPoints: ["mechanisms/eslint/runner/runner.ts", "core/check/tool-command.ts"],
        outputs: [
          output({
            path: "mechanisms/eslint/runner/runner.js",
            entryPoint: "mechanisms/eslint/runner/runner.ts",
            inputs: [],
          }),
          output({ path: "chunks/chunk-A.js", inputs: ["mechanisms/eslint/runner/runner.ts"] }),
        ],
      }),
    ).toEqual([
      "mechanisms/eslint/runner/runner.ts is not emitted with its own code at mechanisms/eslint/runner/runner.js",
      "core/check/tool-command.ts is not emitted with its own code at core/check/tool-command.js",
    ]);
  });
});

const CLOSURE: readonly LockedPackage[] = [
  { name: "zod", version: "4.4.3" },
  { name: "@eslint/plugin-kit", version: "0.7.3" },
  { name: "@eslint/core", version: "1.2.1" },
  { name: "levn", version: "0.4.1" },
  { name: "type-check", version: "0.4.0" },
];

describe("unlockedPackagesOf", () => {
  it("accepts packages bundled at the versions the lock holds in the closure of core's dependencies", () => {
    expect(
      unlockedPackagesOf({
        bundled: [
          { root: "node_modules/zod", name: "zod", version: "4.4.3" },
          { root: "node_modules/levn", name: "levn", version: "0.4.1" },
          { root: "node_modules/@eslint/core", name: "@eslint/core", version: "1.2.1" },
          { root: "node_modules/type-check", name: "type-check", version: "0.4.0" },
        ],
        closure: CLOSURE,
      }),
    ).toEqual([]);
  });

  it("names a bundled package at another version than the one the lock holds", () => {
    expect(
      unlockedPackagesOf({ bundled: [{ root: "node_modules/zod", name: "zod", version: "4.4.2" }], closure: CLOSURE }),
    ).toEqual(["zod 4.4.2 at node_modules/zod, but the lock holds 4.4.3"]);
  });

  it("names a bundled package outside the closure of core's dependencies in the lock", () => {
    expect(
      unlockedPackagesOf({
        bundled: [
          { root: "node_modules/is-glob", name: "is-glob", version: "4.0.3" },
          { root: "node_modules/prelude-ls", name: "prelude-ls", version: "1.2.1" },
        ],
        closure: CLOSURE,
      }),
    ).toEqual([
      "is-glob 4.0.3 at node_modules/is-glob, which is not in the closure of core's dependencies in the lock",
      "prelude-ls 1.2.1 at node_modules/prelude-ls, which is not in the closure of core's dependencies in the lock",
    ]);
  });
});

describe("deadLinksOf", () => {
  it("accepts links to shipped files and folders, anchors, and absolute URLs", () => {
    expect(
      deadLinksOf({
        files: [
          { path: "README.md", text: "[a](ADOPTING.md#2-install) [b](methods/) [c](https://example.com) [d](#runtime)" },
          { path: "ADOPTING.md", text: "[back](README.md)" },
          { path: "methods/README.md", text: "" },
          { path: "rules/CD-1/README.md", text: "[up](../../ADOPTING.md#9-apply)" },
        ],
      }),
    ).toEqual([]);
  });

  it("names each page link to a file the package does not ship", () => {
    expect(
      deadLinksOf({
        files: [
          { path: "README.md", text: "[a](tests/test-fixtures/walkthrough/) [b](MIGRATING.md)" },
          { path: "rules/CD-1/README.md", text: "[piece](../../mechanisms/eslint/CD-1/README.md)" },
          { path: "core/check/tool-command.js", text: "[not](a-link.md)" },
        ],
      }),
    ).toEqual([
      "README.md links to tests/test-fixtures/walkthrough",
      "README.md links to MIGRATING.md",
      "rules/CD-1/README.md links to mechanisms/eslint/CD-1/README.md",
    ]);
  });
});

describe("versionMentionsOf", () => {
  it("accepts pages naming a placeholder tarball, older versions in prose, toolchain versions and other packages' tarballs", () => {
    expect(
      versionMentionsOf({
        files: [
          { path: "README.md", text: "Download `hailstails-hone-<version>.tgz`; TypeScript 4.8.4 or later." },
          { path: "MIGRATING.md", text: "Version `0.1.0-pre.1` shipped as `honed-0.1.0-pre.1.tgz`." },
          { path: "ADOPTING.md", text: "Not `other-core-0.1.0-pre.3.tgz`, and not 0.1.0-pre.30 or 10.1.0-pre.3." },
          { path: "rules/CD-1/discipline.json", text: "hailstails-hone-0.0.0.tgz 0.1.0-pre.3" },
        ],
        tarballStem: "hailstails-hone",
        version: "0.1.0-pre.3",
      }),
    ).toEqual([]);
  });

  it("names each versioned tarball of the package a shipped page names, at any version", () => {
    expect(
      versionMentionsOf({
        files: [
          { path: "README.md", text: "wrote artefacts/hailstails-hone-0.0.0.tgz" },
          { path: "ADOPTING.md", text: "vendor/hailstails-hone/hailstails-hone-0.1.0-pre.3.tgz" },
        ],
        tarballStem: "hailstails-hone",
        version: "0.1.0-pre.3",
      }),
    ).toEqual(["README.md names hailstails-hone-0.0.0.tgz", "ADOPTING.md names hailstails-hone-0.1.0-pre.3.tgz"]);
  });

  it("names each shipped page that names the package's current version, with or without a v", () => {
    expect(
      versionMentionsOf({
        files: [
          { path: "README.md", text: "The current version, `0.1.0`, is stable; so is 0.1.0." },
          { path: "ADOPTING.md", text: "See the [`v0.1.0` release](https://github.com/example/tool/releases/tag/v0.1.0)." },
          { path: "docs/notes.md", text: "Not 0.1.0-pre.3, 0.1.0.1 or 10.1.0." },
        ],
        tarballStem: "hailstails-hone",
        version: "0.1.0",
      }),
    ).toEqual(["README.md names 0.1.0", "README.md names 0.1.0", "ADOPTING.md names v0.1.0", "ADOPTING.md names v0.1.0"]);
  });
});