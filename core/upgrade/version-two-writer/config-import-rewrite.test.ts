import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../values/repo-path.ts";
import { projectionImportingOf, rewrittenConfigOf } from "./config-import-rewrite.ts";

const VERSION_ONE = repoPathSchema.parse("disciplines.eslint.mjs");

const VERSION_TWO = repoPathSchema.parse("hone.eslint.mjs");

describe("rewrittenConfigOf rewriting the one import of the version 1 projection", () => {
  it.each([
    {
      name: "a config at the repository root",
      file: "eslint.config.mjs",
      text: 'import projection from "./disciplines.eslint.mjs";\nexport default [...projection];\n',
      rewritten: 'import projection from "./hone.eslint.mjs";\nexport default [...projection];\n',
    },
    {
      name: "a config in a folder, single-quoted",
      file: "web/eslint.config.mjs",
      text: "import base from '../disciplines.eslint.mjs';\nexport default [...base, { files: ['**/*.ts'] }];\n",
      rewritten: "import base from '../hone.eslint.mjs';\nexport default [...base, { files: ['**/*.ts'] }];\n",
    },
    {
      name: "a config two folders deep, among other imports",
      file: "packages/web/eslint.config.mjs",
      text: 'import js from "@eslint/js";\nimport rules from "../../disciplines.eslint.mjs";\nexport default [js.configs.recommended, ...rules];\n',
      rewritten: 'import js from "@eslint/js";\nimport rules from "../../hone.eslint.mjs";\nexport default [js.configs.recommended, ...rules];\n',
    },
    {
      name: "a config whose import spans several lines",
      file: "eslint.config.mjs",
      text: 'import projection\n  from "./disciplines.eslint.mjs";\nexport default [...projection];\n',
      rewritten: 'import projection\n  from "./hone.eslint.mjs";\nexport default [...projection];\n',
    },
  ])("rewrites only the specifier in $name",({ file, text, rewritten }) => {
    expect(
      rewrittenConfigOf({ file: repoPathSchema.parse(file), text, versionOneProjection: VERSION_ONE, versionTwoProjection: VERSION_TWO }),
    ).toEqual({ outcome: "ok", value: rewritten });
  });
});

describe("rewrittenConfigOf refusing what it cannot rewrite safely", () => {
  it("refuses a config with no import of the version 1 projection, naming the file", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'import js from "@eslint/js";\nexport default [js.configs.recommended];\n',
        versionOneProjection: VERSION_ONE,
        versionTwoProjection: VERSION_TWO,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "no-projection-import", file: "eslint.config.mjs", projection: "disciplines.eslint.mjs" } });
  });

  it("refuses a config whose only import of that name resolves to another folder's file", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'import other from "./web/disciplines.eslint.mjs";\nexport default [...other];\n',
        versionOneProjection: VERSION_ONE,
        versionTwoProjection: VERSION_TWO,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "no-projection-import", file: "eslint.config.mjs", projection: "disciplines.eslint.mjs" } });
  });

  it("refuses a config that imports the version 1 projection twice, naming the file and the count", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'import first from "./disciplines.eslint.mjs";\nimport second from "./disciplines.eslint.mjs";\nexport default [...first, ...second];\n',
        versionOneProjection: VERSION_ONE,
        versionTwoProjection: VERSION_TWO,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "several-projection-imports", file: "eslint.config.mjs", count: 2 } });
  });

  it.each([
    { name: "an import commented out with a line comment", text: '// import projection from "./disciplines.eslint.mjs";\nexport default [];\n' },
    { name: "an import commented out with a block comment", text: '/* import projection from "./disciplines.eslint.mjs"; */\nexport default [];\n' },
    { name: "an import with a default and named bindings", text: 'import projection, { extra } from "./disciplines.eslint.mjs";\nexport default [...projection];\n' },
    { name: "a namespace import", text: 'import * as projection from "./disciplines.eslint.mjs";\nexport default [...projection.default];\n' },
    { name: "a type import", text: 'import type projection from "./disciplines.eslint.mjs";\nexport default [];\n' },
  ])("refuses a config whose only mention of the projection is $name, naming the file", ({ text }) => {
    expect(
      rewrittenConfigOf({ file: repoPathSchema.parse("eslint.config.mjs"), text, versionOneProjection: VERSION_ONE, versionTwoProjection: VERSION_TWO }),
    ).toEqual({ outcome: "failed", error: { kind: "no-projection-import", file: "eslint.config.mjs", projection: "disciplines.eslint.mjs" } });
  });

  it("refuses a config whose import follows a string holding two slashes on its line, as the comment blanking hides it", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'const docs = "https://example.test"; import projection from "./disciplines.eslint.mjs";\nexport default [...projection];\n',
        versionOneProjection: VERSION_ONE,
        versionTwoProjection: VERSION_TWO,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "no-projection-import", file: "eslint.config.mjs", projection: "disciplines.eslint.mjs" } });
  });

  it("refuses a config whose second import of the projection a string holding two slashes hides, never rewriting only the first", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'import first from "./disciplines.eslint.mjs";\nconst docs = "https://example.test"; import second from "./disciplines.eslint.mjs";\n',
        versionOneProjection: VERSION_ONE,
        versionTwoProjection: VERSION_TWO,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "projection-named-elsewhere", file: "eslint.config.mjs" } });
  });

  it("refuses a config that names the projection in a string beside its import, naming the file", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'import projection from "./disciplines.eslint.mjs";\nconst named = "disciplines.eslint.mjs";\nexport default [...projection];\n',
        versionOneProjection: VERSION_ONE,
        versionTwoProjection: VERSION_TWO,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "projection-named-elsewhere", file: "eslint.config.mjs" } });
  });

  it("refuses a config that names the projection anywhere else, naming the file", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'import projection from "./disciplines.eslint.mjs";\nexport default [...projection]; // see disciplines.eslint.mjs\n',
        versionOneProjection: VERSION_ONE,
        versionTwoProjection: VERSION_TWO,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "projection-named-elsewhere", file: "eslint.config.mjs" } });
  });
});

describe("projectionImportingOf", () => {
  it.each([
    { name: "a static default import of the projection", text: 'import projection from "./disciplines.eslint.mjs";\n', importing: "imports" },
    { name: "a dynamic import of the projection", text: 'const projection = await import("./disciplines.eslint.mjs");\n', importing: "does-not-import" },
    { name: "an import of a file of another name", text: 'import other from "./other.mjs";\n', importing: "does-not-import" },
  ] as const)("reads $name as $importing", ({ text, importing }) => {
    expect(projectionImportingOf({ file: repoPathSchema.parse("eslint.config.mjs"), text, versionOneProjection: VERSION_ONE, versionTwoProjection: VERSION_TWO })).toBe(importing);
  });
});
