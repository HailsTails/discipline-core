import { describe, expect, it } from "vitest";
import { createDefaultTypeScriptDeclarationPort } from "./typescript-declaration-port.ts";

const REPO_ROOT = `${import.meta.dirname}/..`;

const port = createDefaultTypeScriptDeclarationPort({});

const emitted = (request: { readonly entryPoints: readonly string[] }) => port.emit({ sourceRoot: REPO_ROOT, entryPoints: request.entryPoints });

describe("the TypeScript declaration port, emitting in memory with the repository's own TypeScript and tsconfig (CD-47: nothing is spawned or written)", () => {
  it("emits a declaration per source module the entry imports, without diagnostics", async () => {
    await expect(emitted({ entryPoints: ["core/mechanism-port/runner-failure-types.ts"] })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        diagnostics: [],
        declarations: [
          { path: "core/mechanism-port/runner-failure-types.d.ts", specifiers: ["../values/repo-path-types.js"] },
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
