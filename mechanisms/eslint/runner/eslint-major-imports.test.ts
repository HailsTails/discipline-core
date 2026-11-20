import { describe, expect, it } from "vitest";
import { type ImportAllowance, importFactsReaching, importNotMatching, importsOutside, importsWithoutFacts } from "../../../tests/confinement.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const ESLINT_MAJOR_SPECIFIER = /^eslint(?:-9)?(?:\/|$)/;

const notAnEslintMajor: ImportAllowance = importNotMatching({ specifier: ESLINT_MAJOR_SPECIFIER });

const outsideTheBoundaries = import.meta.glob(
  [
    "./**/*.{ts,mts,cts,js,mjs,cjs}",
    "!./node_modules/**",
    "!./.claude/**",
    "!./tests/test-fixtures/consumer-proof/**",
    "!./mechanisms/eslint/runner/eslint-9/**",
    "!./mechanisms/eslint/runner/eslint-10/**",
  ],
  { base: "../../../", query: "?raw", import: "default", eager: true },
);

const insideTheBoundaries = import.meta.glob(
  ["./mechanisms/eslint/runner/eslint-9/*.ts", "./mechanisms/eslint/runner/eslint-10/*.ts", "!./mechanisms/eslint/runner/eslint-*/*.test.ts"],
  { base: "../../../", query: "?raw", import: "default", eager: true },
);

describe("where ESLint is imported, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it)", () => {
  it("reads a known file from each scanned set, so no scan is silently empty", () => {
    expect([outsideTheBoundaries, insideTheBoundaries]).toEqual([
      expect.objectContaining({ "./mechanisms/eslint/runner/eslint-instance.ts": expect.any(String) }),
      expect.objectContaining({
        "./mechanisms/eslint/runner/eslint-9/eslint-9-boundary.ts": expect.any(String),
        "./mechanisms/eslint/runner/eslint-10/eslint-10-boundary.ts": expect.any(String),
      }),
    ]);
  });

  it("finds neither boundary importing ESLint itself, each taking its major through the Rule type the common side names", () => {
    expect(importsOutside({ sources: insideTheBoundaries, allowed: [notAnEslintMajor] })).toEqual([]);
  });

  it("finds every static import and re-export of eslint or eslint-9 outside the two boundaries, by file, specifier, form and names, a list that can only shrink", () => {
    expect(importFactsReaching({ sources: outsideTheBoundaries, specifier: ESLINT_MAJOR_SPECIFIER })).toEqual([
      { file: "./mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts", kind: "import", specifier: "eslint", form: "type-only", names: ["ESLint", "Rule"] },
      { file: "./mechanisms/eslint/runner/eslint-instance.ts", kind: "import", specifier: "eslint", form: "type-only", names: ["ESLint"] },
      { file: "./mechanisms/eslint/runner/eslint-instance.ts", kind: "re-export", specifier: "eslint", form: "type-only", names: ["AST", "Rule", "SourceCode"] },
      { file: "./mechanisms/eslint/runner/native-rules.ts", kind: "import", specifier: "eslint/use-at-your-own-risk", form: "value", names: ["builtinRules"] },
      { file: "./tests/test-fixtures/eslint-9/eslint-9-engine.ts", kind: "import", specifier: "eslint-9", form: "value", names: ["ESLint"] },
      { file: "./tests/test-fixtures/eslint-9/eslint-9-engine.ts", kind: "import", specifier: "eslint-9/use-at-your-own-risk", form: "value", names: ["builtinRules"] },
    ]);
  });

  it("finds no static import or re-export of eslint or eslint-9 outside the two boundaries that the facts above fail to hold", () => {
    expect(importsWithoutFacts({ sources: outsideTheBoundaries, specifier: ESLINT_MAJOR_SPECIFIER })).toEqual([]);
  });

  it("finds every import of eslint or eslint-9 of any form outside the two boundaries, the dynamic loads and the one re-export included, by file and form", () => {
    expect(importsOutside({ sources: outsideTheBoundaries, allowed: [notAnEslintMajor] })).toEqual([
      { file: "./mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts", specifier: "eslint", form: "type-only" },
      { file: "./mechanisms/eslint/runner/eslint-instance.ts", specifier: "eslint", form: "type-only" },
      { file: "./mechanisms/eslint/runner/eslint-instance.ts", specifier: "eslint", form: "type-only" },
      { file: "./mechanisms/eslint/runner/eslint-toolchain.ts", specifier: "eslint", form: "dynamic" },
      { file: "./mechanisms/eslint/runner/native-rules.ts", specifier: "eslint/use-at-your-own-risk", form: "value" },
      { file: "./tests/eslint-toolchains.ts", specifier: "eslint-9", form: "dynamic" },
      { file: "./tests/eslint-toolchains.ts", specifier: "eslint-9/use-at-your-own-risk", form: "dynamic" },
      { file: "./tests/test-fixtures/eslint-9/eslint-9-engine.ts", specifier: "eslint-9", form: "value" },
      { file: "./tests/test-fixtures/eslint-9/eslint-9-engine.ts", specifier: "eslint-9/use-at-your-own-risk", form: "value" },
    ]);
  });
});
