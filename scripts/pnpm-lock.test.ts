import { describe, expect, it } from "vitest";
import { installedPackageFolderOf, productionClosureOf } from "./pnpm-lock.ts";

const LOCK = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

importers:

  .:
    dependencies:
      '@eslint/plugin-kit':
        specifier: 0.7.3
        version: 0.7.3
      zod:
        specifier: 4.4.3
        version: 4.4.3
    devDependencies:
      vitest:
        specifier: 4.1.11
        version: 4.1.11(@types/node@25.9.1)

packages:

  zod@4.4.3:
    resolution: {integrity: sha512-a}

snapshots:

  '@eslint/core@1.2.1':
    dependencies:
      '@types/json-schema': 7.0.15

  '@eslint/plugin-kit@0.7.3':
    dependencies:
      '@eslint/core': 1.2.1
      levn: 0.4.1

  '@types/json-schema@7.0.15': {}

  levn@0.4.1:
    dependencies:
      prelude-ls: 1.2.1
    optionalDependencies:
      type-check: 0.4.0

  prelude-ls@1.2.1: {}

  type-check@0.4.0: {}

  vitest@4.1.11(@types/node@25.9.1):
    dependencies:
      levn: 0.5.0
    transitivePeerDependencies:
      - supports-color

  zod@4.4.3: {}
`;

describe("productionClosureOf", () => {
  it("lists core's dependencies and everything they reach, development tools left out", () => {
    expect(productionClosureOf({ lockText: LOCK, dependencies: ["zod", "@eslint/plugin-kit"] })).toEqual({
      outcome: "ok",
      value: [
        { name: "zod", version: "4.4.3" },
        { name: "@eslint/plugin-kit", version: "0.7.3" },
        { name: "@eslint/core", version: "1.2.1" },
        { name: "levn", version: "0.4.1" },
        { name: "@types/json-schema", version: "7.0.15" },
        { name: "prelude-ls", version: "1.2.1" },
        { name: "type-check", version: "0.4.0" },
      ],
    });
  });

  it("fails naming a dependency of core the lock does not hold", () => {
    expect(productionClosureOf({ lockText: LOCK, dependencies: ["zod", "esbuild"] })).toEqual({
      outcome: "failed",
      error: "core depends on esbuild, which the lock does not hold",
    });
  });

  it("fails naming a package the closure holds at two versions", () => {
    const lock = LOCK.replace("      levn: 0.4.1\n", "      levn: 0.4.1\n      zod: 4.4.2\n");
    expect(productionClosureOf({ lockText: lock, dependencies: ["zod", "@eslint/plugin-kit"] })).toEqual({
      outcome: "failed",
      error: "core's dependencies in the lock hold zod at more than one version, which a flat stage cannot place",
    });
  });
});

describe("installedPackageFolderOf", () => {
  it("places a scoped package in the virtual store folder named by its name and version", () => {
    expect(installedPackageFolderOf({ dependencies: "/repo/node_modules", locked: { name: "@eslint/core", version: "1.2.1" } })).toEqual([
      "/repo/node_modules",
      ".pnpm",
      "@eslint+core@1.2.1",
      "node_modules",
      "@eslint",
      "core",
    ]);
  });
});
