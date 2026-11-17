import { describe, expect, it } from "vitest";
import type { DeclarationEmit } from "../scripts/package-declarations.ts";
import { publicTypeReachOf, valueClaimsIn } from "./public-type-reach.ts";
import { defaultParsePort } from "./typescript-parse-port.ts";

const syntaxApi = defaultParsePort.syntaxApi;

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
    expect(publicTypeReachOf({ syntaxApi, emitted: { outcome: "ok", value: EMIT }, entries: ENTRIES, requiredPeers: ["typescript"] })).toEqual({
      problems: [],
      entries: {
        audit: { reached: ["api/audit.d.ts", "core/tree.d.ts"], packageImports: ["typescript"] },
        "rule-set": { reached: ["api/rule-set.d.ts"], packageImports: [] },
      },
      valueDeclaring: ["api/rule-set.d.ts: ruleSet"],
      zodMentioning: [],
    });
  });

  it("names a shipped declaration that mentions zod", () => {
    expect(
      publicTypeReachOf({
        syntaxApi,
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
    expect(publicTypeReachOf({ syntaxApi, emitted: { outcome: "ok", value: EMIT }, entries: ENTRIES, requiredPeers: [] })).toMatchObject({
      problems: ["core/tree.d.ts imports typescript, which is neither shipped nor a required peer"],
      valueDeclaring: [],
    });
  });

  it("names the port's failure as the only problem", () => {
    expect(
      publicTypeReachOf({ syntaxApi, emitted: { outcome: "failed", error: { kind: "declarations-failed", detail: "no tsconfig.json" } }, entries: ENTRIES, requiredPeers: [] }),
    ).toEqual({ problems: ["no tsconfig.json"], entries: {}, valueDeclaring: [], zodMentioning: [] });
  });
});

describe("valueClaimsIn", () => {
  it("names exported values, export assignments, value re-exports and local exports of values", () => {
    expect(
      valueClaimsIn({
        syntaxApi,
        text: 'export declare const answer: 1;\nexport declare function ask(): void;\nexport declare class Asker {}\nexport declare enum Mood { Calm }\nexport declare namespace Space {}\nexport default answer;\ndeclare const hidden: 1;\nexport { hidden };\nexport * from "./other.js";\nexport * as other from "./other.js";\nexport { reply } from "./other.js";\n',
      }),
    ).toEqual([
      "answer",
      "ask",
      "Asker",
      "Mood",
      "Space",
      "export default answer;",
      "hidden",
      'export * from "./other.js";',
      'export * as other from "./other.js";',
      'export { reply } from "./other.js";',
    ]);
  });

  it("claims nothing for types, type-only exports and a private symbol a type depends on", () => {
    expect(
      valueClaimsIn({
        syntaxApi,
        text: 'declare const brand: unique symbol;\nexport type Branded = { readonly [brand]: 1 };\nexport interface Shape {}\ntype Local = 1;\nexport { type Local };\nexport type { Answer } from "./other.js";\nexport {};\n',
      }),
    ).toEqual([]);
  });
});