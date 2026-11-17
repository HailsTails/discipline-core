import { describe, expect, it } from "vitest";
import {
  declarationReachedBy,
  declarationReachOf,
  PROBE_DECLARATION,
  packageSpecifiersIn,
  reachableDeclarations,
  specifiersIn,
} from "./declaration-graph.ts";

const EMITTED: ReadonlyMap<string, string> = new Map([
  ["entry.d.ts", 'export type { A } from "./core/a.ts";\n'],
  ["core/a.d.ts", 'import type { B } from "../shared/b.ts";\nimport type { Z } from "second-package";\nexport type A = B | Z;\n'],
  ["shared/b.d.ts", 'import type { Tool } from "first-package";\nexport type B = Tool;\n'],
  ["unrelated.d.ts", 'import type { Y } from "third-package";\nexport type U = Y;\n'],
]);

describe("specifiersIn", () => {
  it("lists static and re-exported specifiers", () => {
    expect(
      specifiersIn({ text: 'import type { A } from "./a.ts";\nexport type { B } from "second-package";\n' }),
    ).toEqual(["./a.ts", "second-package"]);
  });
});

describe("declarationReachedBy", () => {
  it("resolves a relative .ts specifier to the declaration it names, from the importing declaration's folder", () => {
    expect(declarationReachedBy({ from: "mechanisms/audit/runner/walker-piece.d.ts", specifier: "../../../core/values/result.ts" })).toBe(
      "core/values/result.d.ts",
    );
  });
});

describe("reachableDeclarations", () => {
  it("follows relative specifiers from the root and leaves out declarations nothing reaches", () => {
    expect(reachableDeclarations({ emitted: EMITTED, root: "entry.d.ts" })).toEqual(["core/a.d.ts", "entry.d.ts", "shared/b.d.ts"]);
  });
});

describe("packageSpecifiersIn", () => {
  it("lists each package the given declarations import, once and sorted", () => {
    expect(packageSpecifiersIn({ emitted: EMITTED, declarations: ["entry.d.ts", "core/a.d.ts", "shared/b.d.ts"] })).toEqual([
      "first-package",
      "second-package",
    ]);
  });
});

describe("declarationReachOf, emitting a probe in memory with the repository's own TypeScript (CD-47: nothing is spawned or written)", () => {
  it("reaches the probe and the modules it re-exports, with every reached declaration emitted and no diagnostics", () => {
    expect(declarationReachOf({ probeSource: 'export type { Result } from "./core/values/result.ts";\n' })).toEqual({
      reached: ["core/values/result.d.ts", PROBE_DECLARATION],
      unemitted: [],
      packageImports: [],
      diagnostics: [],
    });
  });

  it("names a package a reached declaration imports", () => {
    expect(declarationReachOf({ probeSource: 'export { repoPathSchema } from "./core/values/repo-path.ts";\n' }).packageImports).toEqual(["zod"]);
  });

  it("reports a diagnostic when the probe names a module that does not exist", () => {
    expect(declarationReachOf({ probeSource: 'export type { Missing } from "./core/values/missing.ts";\n' }).diagnostics).toEqual([
      expect.stringContaining("missing.ts"),
    ]);
  });
});
