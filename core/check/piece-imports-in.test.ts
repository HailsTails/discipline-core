import { describe, expect, it, vi } from "vitest";
import type { PathPort } from "../platform-ports/path-port.ts";
import { importsIn, pieceImportRefusals } from "./piece-import-rules.ts";

describe("importsIn", () => {
  it("reads a static import, a type-only import and a re-export with the specifier as written", () => {
    expect(importsIn({ text: 'import { a } from "./a.ts";\nimport type { B } from "../b.ts";\nexport { c } from "./c.ts";\n' })).toEqual([
      { specifier: "./a.ts", form: "value" },
      { specifier: "../b.ts", form: "type-only" },
      { specifier: "./c.ts", form: "value" },
    ]);
  });

  it("reads a dynamic load of a quoted path as the path", () => {
    expect(importsIn({ text: 'const a = await import("./a.ts");\nconst b = require(\'../b.ts\');\n' })).toEqual([
      { specifier: "./a.ts", form: "dynamic" },
      { specifier: "../b.ts", form: "dynamic" },
    ]);
  });

  it("reads a dynamic load of a template literal without substitutions as the path, as it reads a quoted one", () => {
    expect(importsIn({ text: "const a = await import(`../verdict/verdict.ts`);\nconst b = require(`./b.ts`);\n" })).toEqual([
      { specifier: "../verdict/verdict.ts", form: "dynamic" },
      { specifier: "./b.ts", form: "dynamic" },
    ]);
  });

  it("keeps a template literal with a substitution as the text written, because the path it names is computed", () => {
    expect(importsIn({ text: "const a = await import(`${folder}/a.ts`);\nconst b = await import(`./$${name}.ts`);\n" })).toEqual([
      { specifier: "`${folder}/a.ts`", form: "dynamic" },
      { specifier: "`./$${name}.ts`", form: "dynamic" },
    ]);
  });

  it("keeps a template literal holding an escape as the text written", () => {
    expect(importsIn({ text: "const a = await import(`./a\\u0041.ts`);\n" })).toEqual([{ specifier: "`./a\\u0041.ts`", form: "dynamic" }]);
  });

  it("keeps a quoted path holding backticks as the path between its quotes", () => {
    expect(importsIn({ text: 'const a = await import("`./a.ts`");\n' })).toEqual([{ specifier: "`./a.ts`", form: "dynamic" }]);
  });

  it("keeps a computed argument as the text written", () => {
    expect(importsIn({ text: "const a = await import(modulePath);\n" })).toEqual([{ specifier: "modulePath", form: "dynamic" }]);
  });
});

describe("pieceImportRefusals of a dynamic load written as a template literal", () => {
  const unusedPath: PathPort = {
    join: vi.fn<PathPort["join"]>(),
    relative: vi.fn<PathPort["relative"]>(),
    joinRepository: vi.fn<PathPort["joinRepository"]>(),
    directoryOf: vi.fn<PathPort["directoryOf"]>(),
    repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
    resolve: vi.fn<PathPort["resolve"]>(),
    fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
  };

  it("refuses it as a dynamic import, naming the path without its backticks", () => {
    expect(
      pieceImportRefusals({
        path: unusedPath,
        installRoot: "packages/hone",
        piece: { file: "packages/hone/mechanisms/audit/CD-14/class-syntax.ts", ruleSetRoot: "packages/hone", mechanism: "audit", discipline: "CD-14" },
        source: "export const load = () => import(`./nested/helper.ts`);\n",
        typePackages: [],
      }),
    ).toEqual([{ specifier: "./nested/helper.ts", reason: "dynamic-import" }]);
  });
});
