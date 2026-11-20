import type { DeclarationPort, EmittedDeclaration } from "../scripts/package-declarations.ts";

export const ENTRY_DECLARATIONS: readonly EmittedDeclaration[] = [
  { path: "api/audit.d.ts", text: 'export type { Result } from "../core/values/result.js";\n', specifiers: ["../core/values/result.js"], refusals: [] },
  { path: "api/eslint-plugin.d.ts", text: "export type ChecksPlugin = 1;\n", specifiers: [], refusals: [] },
  { path: "api/rule-set.d.ts", text: "export type RuleSet = 1;\n", specifiers: [], refusals: [] },
  { path: "api/testing.d.ts", text: "export declare const repoPathOf: 1;\n", specifiers: [], refusals: [] },
  { path: "core/values/result.d.ts", text: "export type Result = 1;\n", specifiers: [], refusals: [] },
];

export const emittingDeclarations = (request: { readonly declarations: readonly EmittedDeclaration[] }): DeclarationPort => ({
  emit: () => Promise.resolve({ outcome: "ok", value: { declarations: request.declarations, diagnostics: [] } }),
});
