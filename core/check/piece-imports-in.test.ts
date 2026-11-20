import { describe, expect, it, vi } from "vitest";
import { requiredEntry } from "../../tests/required-entry.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { importsIn, pieceImportRefusals } from "./piece-import-rules.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const fixtures = import.meta.glob(["./tests/test-fixtures/dynamic-loads/computed-loads.txt"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

describe("importsIn", () => {
  it("reads a static import, a type-only import and a re-export with the specifier as written", () => {
    expect(importsIn({ text: 'import { a } from "./a.ts";\nimport type { B } from "../b.ts";\nexport { c } from "./c.ts";\n' })).toEqual([
      { specifier: "./a.ts", form: "value" },
      { specifier: "../b.ts", form: "type-only" },
      { specifier: "./c.ts", form: "value" },
    ]);
  });

  it("reads a dynamic load of a quoted path as the path", () => {
    expect(importsIn({ text: `const a = await import("./a.ts");\nconst b = require('../b.ts');\n` })).toEqual([
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

  it("keeps a template literal with a substitution or an escape, quoted backticks and a variable as the text written, because the path each names is computed or is not the path between them", () => {
    const text = requiredEntry({ table: fixtures, key: "./tests/test-fixtures/dynamic-loads/computed-loads.txt" });
    expect(importsIn({ text })).toEqual([
      { specifier: `\`\${folder}/a.ts\``, form: "dynamic" },
      { specifier: `\`./$\${name}.ts\``, form: "dynamic" },
      { specifier: "`./a\\.ts`", form: "dynamic" },
      { specifier: "`./a.ts`", form: "dynamic" },
      { specifier: "modulePath", form: "dynamic" },
    ]);
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
