import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { parsePortOn } from "../../../tests/typescript-parse-port.ts";
import { textsDisk } from "../runner/walker-disk.ts";
import type { OptionSettings, ResolvedConfig } from "./compiler-options-resolution.ts";
import { typeScriptCompilerOptionsOf } from "./typescript-compiler-options.ts";

const CURRENT = (await parsePortOn({ line: "typescript" })).syntaxApi;
const FLOOR = (await parsePortOn({ line: "typescript-floor" })).syntaxApi;

const LEAF = repoPathSchema.parse("packages/a/tsconfig.json");

const UNSET: OptionSettings = {
  strict: "unset",
  noUncheckedIndexedAccess: "unset",
  exactOptionalPropertyTypes: "unset",
  noImplicitOverride: "unset",
  noFallthroughCasesInSwitch: "unset",
  noPropertyAccessFromIndexSignature: "unset",
  useUnknownInCatchVariables: "unset",
};

const STRICTEST_TEXT = `{
  // comments and trailing commas, as TypeScript accepts them
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
  },
}
`;

const STRICTEST_SETTINGS: OptionSettings = {
  ...UNSET,
  strict: "on",
  noUncheckedIndexedAccess: "on",
  exactOptionalPropertyTypes: "on",
  noImplicitOverride: "on",
  noFallthroughCasesInSwitch: "on",
  noPropertyAccessFromIndexSignature: "on",
};

const STRICTEST_PACKAGE = {
  "node_modules/@tsconfig/strictest/package.json": '{ "name": "@tsconfig/strictest", "version": "2.0.5" }',
  "node_modules/@tsconfig/strictest/tsconfig.json": STRICTEST_TEXT,
};

const ALL_ON = {
  strict: "on",
  noUncheckedIndexedAccess: "on",
  exactOptionalPropertyTypes: "on",
  noImplicitOverride: "on",
  noFallthroughCasesInSwitch: "on",
  noPropertyAccessFromIndexSignature: "on",
  useUnknownInCatchVariables: "on",
} as const;

const resolvedOn = (request: { readonly syntaxApi: typeof CURRENT; readonly texts: Readonly<Record<string, string>> }): ResolvedConfig =>
  typeScriptCompilerOptionsOf({ syntaxApi: request.syntaxApi, disk: textsDisk({ root: "/repository", texts: request.texts }) }).resolve({ file: LEAF });

describe("typeScriptCompilerOptionsOf resolving what a tsconfig.json extends", () => {
  it("follows a relative extends to a base that turns every option on", () => {
    expect(
      resolvedOn({
        syntaxApi: CURRENT,
        texts: {
          [LEAF]: '{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist" } }',
          "tsconfig.base.json": STRICTEST_TEXT,
        },
      }),
    ).toEqual({ kind: "resolved", effective: ALL_ON, bases: [{ file: "tsconfig.base.json", settings: STRICTEST_SETTINGS }] });
  });

  it("follows a package-name base under node_modules", () => {
    expect(resolvedOn({ syntaxApi: CURRENT, texts: { [LEAF]: '{ "extends": "@tsconfig/strictest/tsconfig.json" }', ...STRICTEST_PACKAGE } })).toEqual({
      kind: "resolved",
      effective: ALL_ON,
      bases: [{ file: "node_modules/@tsconfig/strictest/tsconfig.json", settings: STRICTEST_SETTINGS }],
    });
  });

  it("follows a workspace package's base reached through node_modules", () => {
    expect(
      resolvedOn({
        syntaxApi: CURRENT,
        texts: {
          [LEAF]: '{ "extends": "@acme/config/strict.json" }',
          "node_modules/@acme/config/package.json": '{ "name": "@acme/config", "version": "0.0.0" }',
          "node_modules/@acme/config/strict.json": '{ "compilerOptions": { "strict": false } }',
        },
      }),
    ).toEqual({
      kind: "resolved",
      effective: { strict: "off", noUncheckedIndexedAccess: "off", exactOptionalPropertyTypes: "off", noImplicitOverride: "off", noFallthroughCasesInSwitch: "off", noPropertyAccessFromIndexSignature: "off", useUnknownInCatchVariables: "off" },
      bases: [{ file: "node_modules/@acme/config/strict.json", settings: { ...UNSET, strict: "off" } }],
    });
  });

});

describe("typeScriptCompilerOptionsOf applying the bases of a chain in TypeScript's order", () => {
  it("applies an array of bases in order, so a later base turns an option back off", () => {
    expect(
      resolvedOn({
        syntaxApi: CURRENT,
        texts: {
          [LEAF]: '{ "extends": ["@tsconfig/strictest/tsconfig.json", "../../configs/loose.json"] }',
          "configs/loose.json": '{ "compilerOptions": { "noUncheckedIndexedAccess": false } }',
          ...STRICTEST_PACKAGE,
        },
      }),
    ).toEqual({
      kind: "resolved",
      effective: { ...ALL_ON, noUncheckedIndexedAccess: "off" },
      bases: [
        { file: "node_modules/@tsconfig/strictest/tsconfig.json", settings: STRICTEST_SETTINGS },
        { file: "configs/loose.json", settings: { ...UNSET, noUncheckedIndexedAccess: "off" } },
      ],
    });
  });

  it("sees an option a base turns on and a base further down the chain turns off", () => {
    expect(
      resolvedOn({
        syntaxApi: CURRENT,
        texts: {
          [LEAF]: '{ "extends": "../../configs/package.json" }',
          "configs/package.json": '{ "extends": "./shared.json", "compilerOptions": { "noImplicitOverride": false } }',
          "configs/shared.json": STRICTEST_TEXT,
        },
      }),
    ).toEqual({
      kind: "resolved",
      effective: { ...ALL_ON, noImplicitOverride: "off" },
      bases: [
        { file: "configs/package.json", settings: { ...UNSET, noImplicitOverride: "off" } },
        { file: "configs/shared.json", settings: STRICTEST_SETTINGS },
      ],
    });
  });
});

describe("typeScriptCompilerOptionsOf reading strict's defaults as the installed TypeScript does", () => {
  it.each([
    { line: "6", syntaxApi: CURRENT, defaulted: "on" },
    { line: "4.8.4", syntaxApi: FLOOR, defaulted: "off" },
  ])("resolves strict and useUnknownInCatchVariables, set nowhere, to $defaulted under TypeScript $line", ({ syntaxApi, defaulted }) => {
    expect(resolvedOn({ syntaxApi, texts: { [LEAF]: '{ "compilerOptions": { "outDir": "dist" } }' } })).toEqual({
      kind: "resolved",
      effective: {
        strict: defaulted,
        noUncheckedIndexedAccess: "off",
        exactOptionalPropertyTypes: "off",
        noImplicitOverride: "off",
        noFallthroughCasesInSwitch: "off",
        noPropertyAccessFromIndexSignature: "off",
        useUnknownInCatchVariables: defaulted,
      },
      bases: [],
    });
  });

  it("turns useUnknownInCatchVariables off with a base's strict = false", () => {
    expect(
      resolvedOn({ syntaxApi: CURRENT, texts: { [LEAF]: '{ "extends": "../../tsconfig.base.json" }', "tsconfig.base.json": '{ "compilerOptions": { "strict": false } }' } }),
    ).toMatchObject({ kind: "resolved", effective: { strict: "off", useUnknownInCatchVariables: "off" } });
  });
});

const UNRESOLVABLE: readonly {
  readonly name: string;
  readonly extendsValue: string;
  readonly texts: Readonly<Record<string, string>>;
  readonly detail: string;
}[] = [
  {
    name: "a base file that is missing",
    extendsValue: '"../../missing.json"',
    texts: {},
    detail: "TS5083 Cannot read file 'missing.json'.",
  },
  {
    name: "a base package that is not installed",
    extendsValue: '"@tsconfig/absent/tsconfig.json"',
    texts: {},
    detail: "TS6053 File '@tsconfig/absent/tsconfig.json' not found.",
  },
  {
    name: "bases that extend each other",
    extendsValue: '"../../configs/one.json"',
    texts: { "configs/one.json": '{ "extends": "./two.json" }', "configs/two.json": '{ "extends": "./one.json" }' },
    detail: "TS18000 Circularity detected while resolving configuration: packages/a/tsconfig.json -> configs/one.json -> configs/two.json -> configs/one.json",
  },
  {
    name: "the configDir placeholder in extends, which TypeScript does not substitute there",
    extendsValue: `"\${configDir}/../../tsconfig.base.json"`,
    texts: { "tsconfig.base.json": STRICTEST_TEXT },
    detail: `TS6053 File '\${configDir}/../../tsconfig.base.json' not found.`,
  },
];

describe("typeScriptCompilerOptionsOf reporting a configuration TypeScript cannot resolve", () => {
  it.each(UNRESOLVABLE)("is unresolved, with TypeScript's diagnostic, for $name", ({ extendsValue, texts, detail }) => {
    expect(resolvedOn({ syntaxApi: CURRENT, texts: { [LEAF]: `{ "extends": ${extendsValue} }`, ...texts } })).toEqual({ kind: "unresolved", detail });
  });

  it("is unresolved for an array of bases under TypeScript 4.8.4, which takes one base only", () => {
    expect(
      resolvedOn({ syntaxApi: FLOOR, texts: { [LEAF]: '{ "extends": ["../../tsconfig.base.json"] }', "tsconfig.base.json": STRICTEST_TEXT } }),
    ).toEqual({ kind: "unresolved", detail: "TS5024 Compiler option 'extends' requires a value of type string." });
  });

  it("is resolved for a tsconfig.json whose include matches no file, since the check reads no source files", () => {
    expect(resolvedOn({ syntaxApi: CURRENT, texts: { [LEAF]: '{ "include": ["src"], "compilerOptions": { "strict": true } }' } })).toMatchObject({ kind: "resolved" });
  });
});
