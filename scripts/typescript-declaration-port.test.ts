import { describe, expect, it } from "vitest";
import { defaultParsePort } from "../tests/typescript-parse-port.ts";
import { createDefaultTypeScriptDeclarationPort, publishedDeclarationText } from "./typescript-declaration-port.ts";

const REPO_ROOT = `${import.meta.dirname}/..`;

const port = createDefaultTypeScriptDeclarationPort({});

const emitted = (request: { readonly entryPoints: readonly string[] }) => port.emit({ sourceRoot: REPO_ROOT, entryPoints: request.entryPoints });

describe("the TypeScript declaration port, emitting in memory with the repository's own TypeScript and tsconfig (CD-47: nothing is spawned or written)", () => {
  it("emits a declaration per source module the entry imports, without diagnostics", async () => {
    await expect(emitted({ entryPoints: ["core/mechanism-port/piece-failure-types.ts"] })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        diagnostics: [],
        declarations: [
          { path: "core/mechanism-port/piece-failure-types.d.ts", specifiers: ["../values/repo-path-types.js"] },
          { path: "core/values/branded.d.ts", specifiers: [] },
          { path: "core/values/repo-path-types.d.ts", specifiers: ["./branded.js"] },
        ],
      },
    });
  });

  it("rewrites relative .ts specifiers to the .js form a published declaration resolves from", async () => {
    await expect(emitted({ entryPoints: ["core/values/repo-path-types.ts"] })).resolves.toMatchObject({
      outcome: "ok",
      value: { declarations: expect.arrayContaining([expect.objectContaining({ path: "core/values/repo-path-types.d.ts", text: expect.stringContaining('from "./branded.js"') })]) },
    });
  });

  it("leaves out an exported value declaration and keeps the module's types", async () => {
    await expect(emitted({ entryPoints: ["mechanisms/audit/runner/typescript-parse.ts"] })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        declarations: [
          {
            path: "mechanisms/audit/runner/typescript-parse.d.ts",
            specifiers: ["typescript"],
            text: expect.not.stringContaining("defaultTypeScriptModules"),
          },
        ],
      },
    });
  });

  it("keeps the module's type aliases when it leaves out a value", async () => {
    await expect(emitted({ entryPoints: ["mechanisms/audit/runner/typescript-parse.ts"] })).resolves.toMatchObject({
      outcome: "ok",
      value: { declarations: [{ text: expect.stringContaining("export type SyntaxApi = typeof typescript;") }] },
    });
  });

  it("keeps a module-private unique symbol a type depends on", async () => {
    await expect(emitted({ entryPoints: ["core/values/branded.ts"] })).resolves.toMatchObject({
      outcome: "ok",
      value: { declarations: [{ path: "core/values/branded.d.ts", text: expect.stringContaining("declare const brandName: unique symbol;") }] },
    });
  });

  it("reports a diagnostic for an entry that does not exist", async () => {
    await expect(emitted({ entryPoints: ["core/values/missing.ts"] })).resolves.toMatchObject({
      outcome: "ok",
      value: { diagnostics: [expect.stringContaining("missing.ts")] },
    });
  });
});

const syntaxApi = defaultParsePort.syntaxApi;

const VALUE_RE_EXPORT = 'a value re-export from ./other.js; re-export the types by name with "export type { … } from"';

describe("publishedDeclarationText, over declaration text parsed and printed with the repository's own TypeScript", () => {
  it("drops exported values and export assignments, and keeps types and private declarations", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "entry.d.ts",
        text: "export declare const answer: 1;\nexport declare function ask(): void;\nexport declare class Asker {\n}\nexport declare enum Mood {\n    Calm = 0\n}\nexport default answer;\nexport type Answer = 1;\ndeclare const brand: unique symbol;\n",
      }),
    ).toEqual({ text: "export type Answer = 1;\ndeclare const brand: unique symbol;\n", refusals: [] });
  });

  it("leaves a value out of a local export list, drops a list naming only values, and keeps the types beside them", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "entry.d.ts",
        text: "declare const answer = 1;\ntype Answer = number;\nexport { answer, Answer };\nexport { answer as reply };\n",
      }),
    ).toEqual({ text: "declare const answer = 1;\ntype Answer = number;\nexport { Answer };\n", refusals: [] });
  });

  it("refuses every value re-export from another module and keeps a type-only one", () => {
    expect(
      publishedDeclarationText({
        syntaxApi,
        path: "entry.d.ts",
        text: 'export * from "./other.js";\nexport * as other from "./other.js";\nexport { answer } from "./other.js";\nexport type { Answer } from "./other.js";\n',
      }),
    ).toEqual({
      text: 'export type { Answer } from "./other.js";\n',
      refusals: [`entry.d.ts: ${VALUE_RE_EXPORT}`, `entry.d.ts: ${VALUE_RE_EXPORT}`, `entry.d.ts: ${VALUE_RE_EXPORT}`],
    });
  });

  it("refuses an exported namespace, which may hold values", () => {
    expect(publishedDeclarationText({ syntaxApi, path: "entry.d.ts", text: "export declare namespace Space {\n    const inner: 1;\n}\n" })).toEqual({
      text: "export {};\n",
      refusals: ['entry.d.ts: the namespace "Space" may hold values; publish its types as plain exports'],
    });
  });

  it("marks a module whose every statement was dropped as a module still", () => {
    expect(publishedDeclarationText({ syntaxApi, path: "entry.d.ts", text: "export declare const answer: 1;\n" })).toEqual({ text: "export {};\n", refusals: [] });
  });

  it("keeps an empty module marker so a types-only file stays a module", () => {
    expect(publishedDeclarationText({ syntaxApi, path: "entry.d.ts", text: "type Local = 1;\nexport {};\n" })).toEqual({ text: "type Local = 1;\nexport {};\n", refusals: [] });
  });
});