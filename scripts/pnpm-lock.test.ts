import { describe, expect, it } from "vitest";
import { productionClosureOf } from "./pnpm-lock.ts";

const lockOf = (request: {
  readonly header: string;
  readonly importers: string;
  readonly snapshots: string;
}): string => `${request.header}
${request.importers}
${request.snapshots}
`;

const HEADER = "lockfileVersion: '9.0'";

const IMPORTERS = `importers:

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
`;

const SNAPSHOTS = `snapshots:

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

const LOCK = lockOf({ header: HEADER, importers: IMPORTERS, snapshots: SNAPSHOTS });

const kitSnapshotsWith = (request: { readonly levn: string }): string => `snapshots:

  '@eslint/plugin-kit@0.7.3':
    dependencies:
      levn: ${request.levn}

  levn@0.4.1: {}

  zod@4.4.3: {}
`;

const KIT_IMPORTERS = `importers:

  .:
    dependencies:
      '@eslint/plugin-kit':
        specifier: 0.7.3
        version: 0.7.3
      zod:
        specifier: 4.4.3
        version: 4.4.3
`;

const kitLockWith = (request: { readonly levn: string }): string =>
  lockOf({ header: HEADER, importers: KIT_IMPORTERS, snapshots: kitSnapshotsWith(request) });

const UNSUPPORTED_VERSION = lockOf({ header: "lockfileVersion: '8.0'", importers: IMPORTERS, snapshots: SNAPSHOTS });

const WITHOUT_IMPORTERS = lockOf({ header: HEADER, importers: "", snapshots: SNAPSHOTS });

const WITHOUT_SNAPSHOTS = lockOf({ header: HEADER, importers: IMPORTERS, snapshots: "" });

const WITHOUT_ROOT_IMPORTER = lockOf({ header: HEADER, importers: "importers:\n\n  other:\n    dependencies: {}\n", snapshots: SNAPSHOTS });

const WITHOUT_LEVN_SNAPSHOT = lockOf({
  header: HEADER,
  importers: KIT_IMPORTERS,
  snapshots: `snapshots:

  '@eslint/plugin-kit@0.7.3':
    dependencies:
      levn: 0.4.1

  zod@4.4.3: {}
`,
});

const DOUBLE_QUOTED_KEY = lockOf({
  header: HEADER,
  importers: KIT_IMPORTERS,
  snapshots: `snapshots:

  "@eslint/plugin-kit@0.7.3":
    dependencies:
      levn: 0.4.1

  levn@0.4.1: {}

  zod@4.4.3: {}
`,
});

const LINKED_IMPORTER = lockOf({
  header: HEADER,
  importers: `importers:

  .:
    dependencies:
      zod:
        specifier: link:../zod
        version: link:../zod
`,
  snapshots: "snapshots:\n\n  zod@4.4.3: {}\n",
});

const PEER_VARIANTS = lockOf({
  header: HEADER,
  importers: `importers:

  .:
    dependencies:
      zod:
        specifier: 4.4.3
        version: 4.4.3
`,
  snapshots: `snapshots:

  zod@4.4.3:
    dependencies:
      levn: 0.4.1(first@1.0.0)
      other: 1.0.0

  other@1.0.0:
    dependencies:
      levn: 0.4.1(second@2.0.0)

  levn@0.4.1(first@1.0.0): {}

  levn@0.4.1(second@2.0.0):
    dependencies:
      prelude-ls: 1.2.1

  prelude-ls@1.2.1: {}
`,
});

const ZOD_AT_TWO_VERSIONS = lockOf({
  header: HEADER,
  importers: KIT_IMPORTERS,
  snapshots: `snapshots:

  '@eslint/plugin-kit@0.7.3':
    dependencies:
      zod: 4.4.2

  zod@4.4.2: {}

  zod@4.4.3: {}
`,
});

const kitLockHoldingLevn = (request: { readonly levn: string }): string =>
  lockOf({
    header: HEADER,
    importers: KIT_IMPORTERS,
    snapshots: `snapshots:

  '@eslint/plugin-kit@0.7.3':
    dependencies:
      levn: 0.4.1

${request.levn}

  prelude-ls@1.2.1: {}

  zod@4.4.3: {}
`,
  });

const INLINE_SECTION = kitLockHoldingLevn({ levn: `  levn@0.4.1:
    dependencies: {prelude-ls: 1.2.1}` });

const INLINE_SNAPSHOT = kitLockHoldingLevn({ levn: "  levn@0.4.1: {dependencies: {prelude-ls: 1.2.1}}" });

const INLINE_OPTIONAL_SECTION = kitLockHoldingLevn({ levn: `  levn@0.4.1:
    optionalDependencies: {prelude-ls: 1.2.1}` });

const EMPTY_FORMS = kitLockHoldingLevn({ levn: `  levn@0.4.1:
    dependencies: {}
    optionalDependencies:` });

const EMPTY_SNAPSHOT = kitLockHoldingLevn({ levn: "  levn@0.4.1: {}" });

const DEPENDENCIES = ["zod", "@eslint/plugin-kit"];

describe("productionClosureOf", () => {
  it("lists core's dependencies and everything they reach with what each requires, development tools left out", () => {
    expect(productionClosureOf({ lockText: LOCK, dependencies: DEPENDENCIES })).toEqual({
      outcome: "ok",
      value: [
        { name: "zod", version: "4.4.3", requires: [] },
        {
          name: "@eslint/plugin-kit",
          version: "0.7.3",
          requires: [
            { name: "@eslint/core", kind: "required" },
            { name: "levn", kind: "required" },
          ],
        },
        { name: "@eslint/core", version: "1.2.1", requires: [{ name: "@types/json-schema", kind: "required" }] },
        {
          name: "levn",
          version: "0.4.1",
          requires: [
            { name: "prelude-ls", kind: "required" },
            { name: "type-check", kind: "optional" },
          ],
        },
        { name: "@types/json-schema", version: "7.0.15", requires: [] },
        { name: "prelude-ls", version: "1.2.1", requires: [] },
        { name: "type-check", version: "0.4.0", requires: [] },
      ],
    });
  });

});

describe("productionClosureOf on a lock it does not read", () => {
  it("fails naming a dependency of core the lock does not hold", () => {
    expect(productionClosureOf({ lockText: LOCK, dependencies: ["zod", "esbuild"] })).toEqual({
      outcome: "failed",
      error: "core depends on esbuild, which the lock does not hold",
    });
  });

  it("fails naming a package the closure holds at two versions", () => {
    expect(productionClosureOf({ lockText: ZOD_AT_TWO_VERSIONS, dependencies: DEPENDENCIES })).toEqual({
      outcome: "failed",
      error: "core's dependencies in the lock hold zod at more than one version, which a flat stage cannot place",
    });
  });

  it("holds one package for versions that differ only by their peer suffix, with what each variant requires", () => {
    expect(productionClosureOf({ lockText: PEER_VARIANTS, dependencies: ["zod"] })).toEqual({
      outcome: "ok",
      value: [
        {
          name: "zod",
          version: "4.4.3",
          requires: [
            { name: "levn", kind: "required" },
            { name: "other", kind: "required" },
          ],
        },
        { name: "levn", version: "0.4.1", requires: [{ name: "prelude-ls", kind: "required" }] },
        { name: "other", version: "1.0.0", requires: [{ name: "levn", kind: "required" }] },
        { name: "prelude-ls", version: "1.2.1", requires: [] },
      ],
    });
  });

  it("fails naming a lockfileVersion other than the one it reads", () => {
    expect(productionClosureOf({ lockText: UNSUPPORTED_VERSION, dependencies: DEPENDENCIES })).toEqual({
      outcome: "failed",
      error: "the lock's lockfileVersion is 8.0, which is not the supported 9.0",
    });
  });

  it("fails naming a section the lock lacks", () => {
    expect([
      productionClosureOf({ lockText: WITHOUT_IMPORTERS, dependencies: DEPENDENCIES }),
      productionClosureOf({ lockText: WITHOUT_SNAPSHOTS, dependencies: DEPENDENCIES }),
      productionClosureOf({ lockText: WITHOUT_ROOT_IMPORTER, dependencies: DEPENDENCIES }),
    ]).toEqual([
      { outcome: "failed", error: "the lock holds no importers section" },
      { outcome: "failed", error: "the lock holds no snapshots section" },
      { outcome: "failed", error: "the lock holds no importer for the repository root" },
    ]);
  });

  it("fails naming a reached package that has no snapshot", () => {
    expect(productionClosureOf({ lockText: WITHOUT_LEVN_SNAPSHOT, dependencies: DEPENDENCIES })).toEqual({
      outcome: "failed",
      error: "the lock holds no snapshot for levn@0.4.1",
    });
  });

});

describe("productionClosureOf on a value it does not read", () => {
  it("fails naming a double-quoted key it does not read", () => {
    expect(productionClosureOf({ lockText: DOUBLE_QUOTED_KEY, dependencies: DEPENDENCIES })).toEqual({
      outcome: "failed",
      error: 'the lock holds a double-quoted key, which this reader does not read: "@eslint/plugin-kit@0.7.3":',
    });
  });

  it("fails naming each value that is not a plain semver version", () => {
    expect([
      productionClosureOf({ lockText: kitLockWith({ levn: "prelude-ls@1.2.1" }), dependencies: DEPENDENCIES }),
      productionClosureOf({ lockText: kitLockWith({ levn: "npm:levn@0.4.1" }), dependencies: DEPENDENCIES }),
      productionClosureOf({ lockText: kitLockWith({ levn: "link:../levn" }), dependencies: DEPENDENCIES }),
      productionClosureOf({ lockText: kitLockWith({ levn: "file:../levn" }), dependencies: DEPENDENCIES }),
      productionClosureOf({ lockText: kitLockWith({ levn: "workspace:*" }), dependencies: DEPENDENCIES }),
      productionClosureOf({ lockText: kitLockWith({ levn: "" }), dependencies: DEPENDENCIES }),
      productionClosureOf({ lockText: kitLockWith({ levn: "latest" }), dependencies: DEPENDENCIES }),
      productionClosureOf({ lockText: kitLockWith({ levn: "{a: 1}" }), dependencies: DEPENDENCIES }),
    ]).toEqual([
      { outcome: "failed", error: "@eslint/plugin-kit@0.7.3 holds an alias for levn: prelude-ls@1.2.1" },
      { outcome: "failed", error: "@eslint/plugin-kit@0.7.3 holds an alias for levn: npm:levn@0.4.1" },
      { outcome: "failed", error: "@eslint/plugin-kit@0.7.3 holds a link: value for levn: link:../levn" },
      { outcome: "failed", error: "@eslint/plugin-kit@0.7.3 holds a file: value for levn: file:../levn" },
      { outcome: "failed", error: "@eslint/plugin-kit@0.7.3 holds a workspace: value for levn: workspace:*" },
      { outcome: "failed", error: "@eslint/plugin-kit@0.7.3 holds an empty version for levn" },
      { outcome: "failed", error: "@eslint/plugin-kit@0.7.3 holds a version that is not semver for levn: latest" },
      { outcome: "failed", error: "@eslint/plugin-kit@0.7.3 holds a flow value for levn: {a: 1}" },
    ]);
  });

  it("fails naming a dependency section or a snapshot written as a non-empty inline value", () => {
    expect([
      productionClosureOf({ lockText: INLINE_SECTION, dependencies: DEPENDENCIES }),
      productionClosureOf({ lockText: INLINE_OPTIONAL_SECTION, dependencies: DEPENDENCIES }),
      productionClosureOf({ lockText: INLINE_SNAPSHOT, dependencies: DEPENDENCIES }),
    ]).toEqual([
      { outcome: "failed", error: "levn@0.4.1 holds an inline value for dependencies: {prelude-ls: 1.2.1}" },
      { outcome: "failed", error: "levn@0.4.1 holds an inline value for optionalDependencies: {prelude-ls: 1.2.1}" },
      { outcome: "failed", error: "the lock holds an inline value for levn@0.4.1: {dependencies: {prelude-ls: 1.2.1}}" },
    ]);
  });

  it("accepts a snapshot and its dependency sections written empty or as {}", () => {
    expect([
      productionClosureOf({ lockText: EMPTY_FORMS, dependencies: DEPENDENCIES }),
      productionClosureOf({ lockText: EMPTY_SNAPSHOT, dependencies: DEPENDENCIES }),
    ]).toEqual([
      { outcome: "ok", value: expect.arrayContaining([{ name: "levn", version: "0.4.1", requires: [] }]) },
      { outcome: "ok", value: expect.arrayContaining([{ name: "levn", version: "0.4.1", requires: [] }]) },
    ]);
  });

  it("fails naming a value of the root importer that is not a plain semver version", () => {
    expect(productionClosureOf({ lockText: LINKED_IMPORTER, dependencies: ["zod"] })).toEqual({
      outcome: "failed",
      error: "the root importer holds a link: value for zod: link:../zod",
    });
  });
});
