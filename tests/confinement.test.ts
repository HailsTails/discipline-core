import { describe, expect, it } from "vitest";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import {
  computedModuleLoad,
  filesNotMatching,
  filesReaching,
  importsOutside,
  importsOutsideFromOwnFolder,
  importStatementsReaching,
  nodeBuiltinImport,
  packageImport,
  packageOrComputedImport,
  packageTypeImport,
  pathCallsOutside,
  relativeImport,
  relativeImportOfAnyForm,
  relativeImportNotNaming,
  relativeImportReaching,
  sourcesNamed,
  sourcesNotNamed,
} from "./confinement.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/install" });

const underCore = relativeImportReaching({ importingFolder: "core/folder", reach: /^core\// });

describe("relativeImport", () => {
  it("allows a relative value import and a relative type-only import", () => {
    expect([
      relativeImport({ moduleImport: { specifier: "./a.ts", form: "value" } }),
      relativeImport({ moduleImport: { specifier: "../b.ts", form: "type-only" } }),
    ]).toEqual(["allowed", "allowed"]);
  });

  it("refuses a relative dynamic import and a package import", () => {
    expect([
      relativeImport({ moduleImport: { specifier: "./a.ts", form: "dynamic" } }),
      relativeImport({ moduleImport: { specifier: "zod", form: "value" } }),
    ]).toEqual(["outside", "outside"]);
  });
});

describe("relativeImportOfAnyForm", () => {
  it("allows a relative dynamic import and refuses a package import", () => {
    expect([
      relativeImportOfAnyForm({ moduleImport: { specifier: "./a.ts", form: "dynamic" } }),
      relativeImportOfAnyForm({ moduleImport: { specifier: "vitest", form: "value" } }),
    ]).toEqual(["allowed", "outside"]);
  });
});

describe("nodeBuiltinImport", () => {
  it("allows a static node builtin import and refuses a dynamic one and a package", () => {
    expect([
      nodeBuiltinImport({ moduleImport: { specifier: "node:path", form: "value" } }),
      nodeBuiltinImport({ moduleImport: { specifier: "node:path", form: "dynamic" } }),
      nodeBuiltinImport({ moduleImport: { specifier: "path", form: "value" } }),
    ]).toEqual(["allowed", "outside", "outside"]);
  });
});

describe("computedModuleLoad", () => {
  it("allows a dynamic load of a computed specifier and refuses a literal one or a static import", () => {
    expect([
      computedModuleLoad({ moduleImport: { specifier: "pathToFileURL(request.path", form: "dynamic" } }),
      computedModuleLoad({ moduleImport: { specifier: "./runner.ts", form: "dynamic" } }),
      computedModuleLoad({ moduleImport: { specifier: "pathToFileURL(request.path", form: "value" } }),
    ]).toEqual(["allowed", "outside", "outside"]);
  });
});

describe("packageOrComputedImport", () => {
  it("allows any specifier not starting with a dot", () => {
    expect([
      packageOrComputedImport({ moduleImport: { specifier: "zod", form: "value" } }),
      packageOrComputedImport({ moduleImport: { specifier: "request.path", form: "dynamic" } }),
      packageOrComputedImport({ moduleImport: { specifier: "../a.ts", form: "value" } }),
    ]).toEqual(["allowed", "allowed", "outside"]);
  });
});

describe("packageImport", () => {
  it("allows the named package by value or type only, and refuses another package or a dynamic load", () => {
    expect([
      packageImport({ packageName: "eslint" })({ moduleImport: { specifier: "eslint", form: "value" } }),
      packageImport({ packageName: "eslint" })({ moduleImport: { specifier: "eslint", form: "type-only" } }),
      packageImport({ packageName: "eslint" })({ moduleImport: { specifier: "eslint", form: "dynamic" } }),
      packageImport({ packageName: "eslint" })({ moduleImport: { specifier: "eslint-scope", form: "value" } }),
    ]).toEqual(["allowed", "allowed", "outside", "outside"]);
  });
});

describe("packageTypeImport", () => {
  it("allows the named package type only and refuses it by value", () => {
    expect([
      packageTypeImport({ packageName: "typescript" })({ moduleImport: { specifier: "typescript", form: "type-only" } }),
      packageTypeImport({ packageName: "typescript" })({ moduleImport: { specifier: "typescript", form: "value" } }),
    ]).toEqual(["allowed", "outside"]);
  });
});

describe("relativeImportReaching", () => {
  it("allows a relative import resolving inside the reach, of any form", () => {
    expect([
      underCore({ moduleImport: { specifier: "../values/result.ts", form: "value" } }),
      underCore({ moduleImport: { specifier: "./sibling.ts", form: "dynamic" } }),
    ]).toEqual(["allowed", "allowed"]);
  });

  it("refuses a relative import resolving outside the reach, and a package import", () => {
    expect([
      underCore({ moduleImport: { specifier: "../../mechanisms/audit/runner/runner.ts", form: "value" } }),
      underCore({ moduleImport: { specifier: "../../../outside.ts", form: "value" } }),
      underCore({ moduleImport: { specifier: "zod", form: "value" } }),
    ]).toEqual(["outside", "outside", "outside"]);
  });
});

describe("importsOutsideFromOwnFolder", () => {
  const sources = {
    "./core/run/a.ts": 'import { x } from "../values/x.ts";\nimport { y } from "../check/y.ts";\n',
    "./core/run/deeper/b.ts": 'import { x } from "../../values/x.ts";\nimport { y } from "../../check/y.ts";\nimport { z } from "../check/z.ts";\n',
  };

  const reachingNothingUnderCheck = ({ importingFolder }: { readonly importingFolder: string }) => [
    relativeImportReaching({ importingFolder, reach: /^(?!core\/check\/)/ }),
  ];

  it("resolves each import from its own file's folder, so a file in a subfolder reaching core/check is refused", () => {
    expect(importsOutsideFromOwnFolder({ sources, allowedFrom: reachingNothingUnderCheck })).toEqual([
      { file: "./core/run/a.ts", specifier: "../check/y.ts", form: "value" },
      { file: "./core/run/deeper/b.ts", specifier: "../../check/y.ts", form: "value" },
    ]);
  });
});

describe("filesReaching", () => {
  const sources = {
    "./core/run/direct.ts": 'import { a } from "../held/a.ts";\n',
    "./core/run/indirect.ts": 'import { b } from "../mid/b.ts";\n',
    "./core/run/deep/deeper.ts": 'import { b } from "../../mid/b.ts";\n',
    "./core/run/clean.ts": 'import { c } from "../mid/c.ts";\nimport { z } from "zod";\n',
    "./core/run/loop-a.ts": 'import { b } from "./loop-b.ts";\n',
    "./core/run/loop-b.ts": 'import { a } from "./loop-a.ts";\n',
    "./core/mid/b.ts": 'import { a } from "../held/a.ts";\n',
    "./core/mid/c.ts": "export const c = 1;\n",
    "./core/held/a.ts": "export const a = 1;\n",
  };

  it("lists each file under the starting pattern that imports, directly or through other scanned files, a file matching the reached pattern", () => {
    expect(filesReaching({ sources, startingFrom: /^\.\/core\/run\//, reaching: /^\.\/core\/held\// })).toEqual([
      "./core/run/deep/deeper.ts",
      "./core/run/direct.ts",
      "./core/run/indirect.ts",
    ]);
  });
});

describe("importStatementsReaching", () => {
  it("lists each import statement whose specifier matches, whole, with its file, so the names it imports are pinned", () => {
    expect(
      importStatementsReaching({
        sources: {
          "./a.ts": 'import type { One, Two } from "../held/one.ts";\nimport { z } from "zod";\nimport {\n  Three,\n} from "../held/three.ts";\n',
          "./b.ts": 'import { other } from "../free/other.ts";\n',
        },
        specifier: /^\.\.\/held\//,
      }),
    ).toEqual([
      { file: "./a.ts", statement: 'import type { One, Two } from "../held/one.ts";' },
      { file: "./a.ts", statement: 'import {\n  Three,\n} from "../held/three.ts";' },
    ]);
  });
});

describe("importsOutside", () => {
  it("lists each import no allowance allows, with its file, in source order", () => {
    expect(
      importsOutside({
        sources: {
          "./a.ts": 'import { z } from "zod";\nimport { b } from "./b.ts";\nimport ts from "typescript";\n',
          "./b.ts": 'export type { Padding } from "left-pad";\n',
        },
        allowed: [relativeImport, packageImport({ packageName: "zod" })],
      }),
    ).toEqual([
      { file: "./a.ts", specifier: "typescript", form: "value" },
      { file: "./b.ts", specifier: "left-pad", form: "type-only" },
    ]);
  });

  it("lists nothing when every import is allowed", () => {
    expect(
      importsOutside({
        sources: { "./a.ts": 'import { b } from "./b.ts";\nimport type { T } from "vitest";\n' },
        allowed: [relativeImport, packageImport({ packageName: "vitest" })],
      }),
    ).toEqual([]);
  });
});

describe("relativeImportNotNaming", () => {
  const notNamingTwo = relativeImportNotNaming({ importingFolder: "pkg/runner", files: ["a.ts", "b.test.ts"] });

  it("allows a sibling import of a file not named, an import of a same-named file in another folder, and a package import", () => {
    expect([
      notNamingTwo({ moduleImport: { specifier: "./c.ts", form: "value" } }),
      notNamingTwo({ moduleImport: { specifier: "../other/a.ts", form: "value" } }),
      notNamingTwo({ moduleImport: { specifier: "zod", form: "value" } }),
    ]).toEqual(["allowed", "allowed", "allowed"]);
  });

  it("refuses an import of each file named, in any form", () => {
    expect([
      notNamingTwo({ moduleImport: { specifier: "./a.ts", form: "value" } }),
      notNamingTwo({ moduleImport: { specifier: "./b.test.ts", form: "type-only" } }),
    ]).toEqual(["outside", "outside"]);
  });

  it("refuses an import of a file named however its specifier reaches the folder", () => {
    expect([
      notNamingTwo({ moduleImport: { specifier: "../runner/a.ts", form: "value" } }),
      notNamingTwo({ moduleImport: { specifier: "./x/../a.ts", form: "value" } }),
    ]).toEqual(["outside", "outside"]);
  });
});

describe("sourcesNamed", () => {
  const sources = { "./dir/a.ts": "a", "./dir/b.ts": "b", "./dir/c.ts": "c" };

  it("gives the sources whose file name is in the list", () => {
    expect(sourcesNamed({ sources, files: ["a.ts", "c.ts"] })).toEqual({ "./dir/a.ts": "a", "./dir/c.ts": "c" });
  });
});

describe("sourcesNotNamed", () => {
  const sources = { "./dir/a.ts": "a", "./dir/b.ts": "b", "./dir/c.ts": "c" };

  it("gives the sources whose file name is not in the list", () => {
    expect(sourcesNotNamed({ sources, files: ["a.ts", "c.ts"] })).toEqual({ "./dir/b.ts": "b" });
  });
});

describe("filesNotMatching", () => {
  it("lists each file whose whole text the pattern does not match", () => {
    expect(
      filesNotMatching({
        sources: { "./kept.ts": "const kept = 1;\n", "./broken.ts": 'import { x } from "../core/check/x.ts";\n' },
        pattern: /^(?!.*core\/check\/).*$/s,
      }),
    ).toEqual(["./broken.ts"]);
  });
});

describe("pathCallsOutside", () => {
  it("reports at least one call and lists the observed paths outside the root or the pattern", () => {
    expect(
      pathCallsOutside({
        path: posixPath,
        root: "/install",
        calls: [[{ path: "/install/core/a.ts" }], [{ path: "/install/tests/b.ts" }], [{ path: "/elsewhere/c.ts" }]],
        paths: /^core\//,
      }),
    ).toEqual({ called: "at least once", outside: ["/install/tests/b.ts", "/elsewhere/c.ts"] });
  });

  it("reports never when no call was made", () => {
    expect(pathCallsOutside({ path: posixPath, root: "/install", calls: [], paths: /^core\// })).toEqual({
      called: "never",
      outside: [],
    });
  });
});
