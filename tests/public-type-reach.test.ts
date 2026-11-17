import { describe, expect, it } from "vitest";
import type { DeclarationEmit } from "../scripts/package-declarations.ts";
import { publicTypeReachOf } from "./public-type-reach.ts";

const ENTRIES = [
  { subpath: "audit", source: "api/audit.ts" },
  { subpath: "rule-set", source: "api/rule-set.ts" },
];

const EMIT: DeclarationEmit = {
  diagnostics: [],
  declarations: [
    { path: "api/audit.d.ts", text: 'export type { Tree } from "../core/tree.js";\n', specifiers: ["../core/tree.js"] },
    { path: "api/rule-set.d.ts", text: "export declare const ruleSet: 1;\n", specifiers: [] },
    { path: "core/tree.d.ts", text: 'import type typescript from "typescript";\nexport type Tree = typescript.Node;\n', specifiers: ["typescript"] },
    { path: "core/schema.d.ts", text: 'import { z } from "zod";\n', specifiers: ["zod"] },
  ],
};

describe("publicTypeReachOf", () => {
  it("names each entry's reached declarations and the packages they import, and the shipped declarations that claim a value", () => {
    expect(publicTypeReachOf({ emitted: { outcome: "ok", value: EMIT }, entries: ENTRIES, requiredPeers: ["typescript"] })).toEqual({
      problems: [],
      entries: {
        audit: { reached: ["api/audit.d.ts", "core/tree.d.ts"], packageImports: ["typescript"] },
        "rule-set": { reached: ["api/rule-set.d.ts"], packageImports: [] },
      },
      valueDeclaring: ["api/rule-set.d.ts"],
      zodMentioning: [],
    });
  });

  it("names a shipped declaration that mentions zod", () => {
    expect(
      publicTypeReachOf({
        emitted: {
          outcome: "ok",
          value: { diagnostics: [], declarations: [{ path: "api/audit.d.ts", text: "export type Schema = 'zod';\n", specifiers: [] }] },
        },
        entries: [{ subpath: "audit", source: "api/audit.ts" }],
        requiredPeers: [],
      }).zodMentioning,
    ).toEqual(["api/audit.d.ts"]);
  });

  it("names the publication problems and ships nothing when a reached declaration imports a package that is not a required peer", () => {
    expect(publicTypeReachOf({ emitted: { outcome: "ok", value: EMIT }, entries: ENTRIES, requiredPeers: [] })).toMatchObject({
      problems: ["core/tree.d.ts imports typescript, which is neither shipped nor a required peer"],
      valueDeclaring: [],
    });
  });

  it("names the port's failure as the only problem", () => {
    expect(
      publicTypeReachOf({ emitted: { outcome: "failed", error: { kind: "declarations-failed", detail: "no tsconfig.json" } }, entries: ENTRIES, requiredPeers: [] }),
    ).toEqual({ problems: ["no tsconfig.json"], entries: {}, valueDeclaring: [], zodMentioning: [] });
  });
});
