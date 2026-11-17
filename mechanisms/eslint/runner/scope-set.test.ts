import { describe, expect, it } from "vitest";
import type { NativeException } from "../../../core/mechanism-port/runner-result-schema.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import type { ResolvedConfig } from "./eslint-config-schema.ts";
import { type FileConfigs, type GovernedPluginRule, scopeSetPartition } from "./scope-set.ts";

const CLAUSE = clauseAddressSchema.parse("CD-14#class-syntax");

const FILE = repoPathSchema.parse("src/a.ts");

const OTHER_FILE = repoPathSchema.parse("src/b.ts");

const typescriptParser = { parseForESLint: () => ({}) };

const otherParser = { parseForESLint: () => ({}) };

const javascriptLanguage = { fileType: "text" };

const honePlugin = { rules: { "no-class-authoring": {} } };

const copiedHonePlugin = { rules: { "no-class-authoring": {} } };

const GOVERNED_RULES: readonly GovernedPluginRule[] = [
  { ruleId: "hone/no-class-authoring", pluginNamespace: "hone", loadedPlugin: honePlugin },
];

const GOVERNANCE: ResolvedConfig = {
  language: javascriptLanguage,
  languageOptions: { parser: typescriptParser },
  plugins: { hone: copiedHonePlugin, "hone-core": {} },
  rules: { "hone/no-class-authoring": [2, { allowStatic: false, allowEmpty: true }], "hone-core/inline-config": [2] },
};

const MATCHING_TEAM: ResolvedConfig = {
  language: javascriptLanguage,
  languageOptions: { parser: typescriptParser, ecmaVersion: 2026, sourceType: "module" },
  plugins: { "@": {}, hone: honePlugin, team: {} },
  rules: { "hone/no-class-authoring": [2, { allowStatic: false, allowEmpty: true }], "no-console": [1] },
};

const CLEAN_TEXT = "export const value = 1;\n";

const fileConfigs = (request: { readonly team: ResolvedConfig; readonly text?: string }): FileConfigs => ({
  file: FILE,
  text: request.text ?? CLEAN_TEXT,
  team: request.team,
  governance: GOVERNANCE,
});

const partitionOf = (request: {
  readonly files: readonly FileConfigs[];
  readonly nativeExceptions?: readonly NativeException[];
}) =>
  scopeSetPartition({
    files: request.files,
    governedRules: GOVERNED_RULES,
    nativeExceptions: request.nativeExceptions ?? [],
  });

const SUPPRESSION_ENTRY: NativeException = {
  kind: "suppression-entry",
  clause: CLAUSE,
  file: FILE,
  location: repoPathSchema.parse("eslint-suppressions.json"),
};

const COMMAND_LINE_OPTION: NativeException = {
  kind: "command-line-option",
  clause: CLAUSE,
  location: repoPathSchema.parse("package.json"),
  script: "lint",
  option: "--rule hone/no-class-authoring: off",
  cause: { kind: "weakens-run" },
};

const teamWithEntry = (request: { readonly entry: readonly [0 | 1 | 2, ...unknown[]] }): ResolvedConfig => ({
  ...MATCHING_TEAM,
  rules: { "hone/no-class-authoring": [...request.entry] },
});

const DIFFERING_RULE_ENTRIES: readonly { readonly label: string; readonly team: ResolvedConfig }[] = [
  { label: "turns the rule off", team: teamWithEntry({ entry: [0, { allowStatic: false, allowEmpty: true }] }) },
  { label: "sets the rule to warn", team: teamWithEntry({ entry: [1, { allowStatic: false, allowEmpty: true }] }) },
];

const DIFFERING_OPTIONS: readonly { readonly label: string; readonly team: ResolvedConfig }[] = [
  { label: "gives the rule other options", team: teamWithEntry({ entry: [2, { allowStatic: true, allowEmpty: true }] }) },
  { label: "leaves out an option key", team: teamWithEntry({ entry: [2, { allowStatic: false }] }) },
  { label: "gives the rule fewer options", team: teamWithEntry({ entry: [2] }) },
  {
    label: "gives the rule an extra option",
    team: teamWithEntry({ entry: [2, { allowStatic: false, allowEmpty: true }, "always"] }),
  },
];

describe("scopeSetPartition over the rule entries of the team's configuration", () => {
  it("leaves out of the scope set a file whose team configuration runs every selected rule exactly as the governance run does", () => {
    expect(partitionOf({ files: [fileConfigs({ team: MATCHING_TEAM })] })).toEqual({ scopeSet: [], rest: [FILE] });
  });

  it("puts a file the team's configuration ignores in the scope set", () => {
    expect(partitionOf({ files: [fileConfigs({ team: undefined })] })).toEqual({
      scopeSet: [{ file: FILE, reasons: ["ignored"] }],
      rest: [],
    });
  });

  it.each(DIFFERING_RULE_ENTRIES)("puts a file in the scope set when the team's configuration $label", ({ team }) => {
    expect(partitionOf({ files: [fileConfigs({ team })] })).toEqual({
      scopeSet: [{ file: FILE, reasons: ["rule-differs"] }],
      rest: [],
    });
  });

  it.each(DIFFERING_OPTIONS)(
    "puts a file in the scope set when the team's configuration $label, option comparison pinned here only and not proven by report comparison",
    ({ team }) => {
      expect(partitionOf({ files: [fileConfigs({ team })] })).toEqual({
        scopeSet: [{ file: FILE, reasons: ["rule-differs"] }],
        rest: [],
      });
    },
  );

  it("puts a file in the scope set when the team's configuration leaves the rule out", () => {
    expect(partitionOf({ files: [fileConfigs({ team: { ...MATCHING_TEAM, rules: {} } })] })).toEqual({
      scopeSet: [{ file: FILE, reasons: ["rule-differs"] }],
      rest: [],
    });
  });

  it("matches the same options written in another key order, option comparison pinned here only and not proven by report comparison", () => {
    expect(
      partitionOf({
        files: [
          fileConfigs({
            team: { ...MATCHING_TEAM, rules: { "hone/no-class-authoring": [2, { allowEmpty: true, allowStatic: false }] } },
          }),
        ],
      }),
    ).toEqual({ scopeSet: [], rest: [FILE] });
  });
});

describe("scopeSetPartition over the parser, language, processor and plugins of the team's configuration", () => {
  it("puts a file in the scope set when the team's configuration parses it with another parser", () => {
    expect(
      partitionOf({ files: [fileConfigs({ team: { ...MATCHING_TEAM, languageOptions: { parser: otherParser } } })] }),
    ).toEqual({ scopeSet: [{ file: FILE, reasons: ["parser-differs"] }], rest: [] });
  });

  it("puts a file in the scope set when the team's configuration names no parser and ESLint's default would parse it", () => {
    expect(partitionOf({ files: [fileConfigs({ team: { ...MATCHING_TEAM, languageOptions: {} } })] })).toEqual({
      scopeSet: [{ file: FILE, reasons: ["parser-differs"] }],
      rest: [],
    });
  });

  it("puts a file in the scope set when the team's configuration sets another language", () => {
    expect(partitionOf({ files: [fileConfigs({ team: { ...MATCHING_TEAM, language: { fileType: "json" } } })] })).toEqual({
      scopeSet: [{ file: FILE, reasons: ["language-differs"] }],
      rest: [],
    });
  });

  it("puts a file in the scope set when the team's configuration runs it through a processor", () => {
    expect(partitionOf({ files: [fileConfigs({ team: { ...MATCHING_TEAM, processor: "team/markdown" } })] })).toEqual({
      scopeSet: [{ file: FILE, reasons: ["processor-differs"] }],
      rest: [],
    });
  });

  it("compares the team's plugin with the module Hone loaded, not with the copy Hone validated into its own configuration", () => {
    expect(partitionOf({ files: [fileConfigs({ team: MATCHING_TEAM })] })).toEqual({ scopeSet: [], rest: [FILE] });
  });

  it("puts a file in the scope set as plugin-differs when the selected namespace is missing from the team's plugins, pinned here only and not proven by report comparison", () => {
    expect(partitionOf({ files: [fileConfigs({ team: { ...MATCHING_TEAM, plugins: {} } })] })).toEqual({
      scopeSet: [{ file: FILE, reasons: ["plugin-differs"] }],
      rest: [],
    });
  });

  it("puts a file in the scope set as plugin-differs when the selected namespace resolves to another plugin object, even one shaped the same, pinned here only and not proven by report comparison", () => {
    expect(
      partitionOf({ files: [fileConfigs({ team: { ...MATCHING_TEAM, plugins: { hone: copiedHonePlugin } } })] }),
    ).toEqual({ scopeSet: [{ file: FILE, reasons: ["plugin-differs"] }], rest: [] });
  });
});

describe("scopeSetPartition over the text of each file", () => {
  it.each([
    "/* eslint-disable */",
    "/*eslint-disable*/",
    "// eslint-disable-next-line hone/no-class-authoring",
    "//eslint-disable-line",
    '/* eslint hone/no-class-authoring: "off" */',
    "/*\n  eslint-disable\n*/",
    "/* eslint-enable */",
    "/* global window */",
    "/* globals window */",
    "/* exported value */",
  ])("puts a file whose text holds the comment %j in the scope set", (comment) => {
    expect(partitionOf({ files: [fileConfigs({ team: MATCHING_TEAM, text: `${comment}\nexport const value = 1;\n` })] })).toEqual({
      scopeSet: [{ file: FILE, reasons: ["directive-text"] }],
      rest: [],
    });
  });

  it.each([
    "/** eslint-disable */",
    "/* ESLINT-DISABLE */",
    "// global window",
    "// the eslint config",
    "const lint = 'eslint';",
  ])("leaves a file whose text holds only %j out of the scope set", (comment) => {
    expect(partitionOf({ files: [fileConfigs({ team: MATCHING_TEAM, text: `${comment}\nexport const value = 1;\n` })] })).toEqual({
      scopeSet: [],
      rest: [FILE],
    });
  });

});

describe("scopeSetPartition over suppression entries and lint scripts", () => {
  it("puts a file named by a suppression entry in the scope set and leaves the other file out", () => {
    expect(
      partitionOf({
        files: [fileConfigs({ team: MATCHING_TEAM }), { ...fileConfigs({ team: MATCHING_TEAM }), file: OTHER_FILE }],
        nativeExceptions: [SUPPRESSION_ENTRY],
      }),
    ).toEqual({ scopeSet: [{ file: FILE, reasons: ["suppression-entry"] }], rest: [OTHER_FILE] });
  });

  it("puts every file under a package in the scope set when that package's lint script carries a weakening command-line option", () => {
    expect(
      partitionOf({
        files: [
          { ...fileConfigs({ team: MATCHING_TEAM }), file: repoPathSchema.parse("packages/a/src/x.ts") },
          { ...fileConfigs({ team: MATCHING_TEAM }), file: repoPathSchema.parse("packages/ab/src/y.ts") },
          fileConfigs({ team: MATCHING_TEAM }),
        ],
        nativeExceptions: [{ ...COMMAND_LINE_OPTION, location: repoPathSchema.parse("packages/a/package.json") }],
      }),
    ).toEqual({
      scopeSet: [{ file: "packages/a/src/x.ts", reasons: ["command-line-option"] }],
      rest: ["packages/ab/src/y.ts", FILE],
    });
  });

  it("puts every file in the scope set when the root package's lint script carries a weakening command-line option", () => {
    expect(
      partitionOf({
        files: [fileConfigs({ team: MATCHING_TEAM }), { ...fileConfigs({ team: MATCHING_TEAM }), file: OTHER_FILE }],
        nativeExceptions: [COMMAND_LINE_OPTION],
      }),
    ).toEqual({
      scopeSet: [
        { file: FILE, reasons: ["command-line-option"] },
        { file: OTHER_FILE, reasons: ["command-line-option"] },
      ],
      rest: [],
    });
  });

});

describe("scopeSetPartition reasons and order", () => {
  it("lists every reason a file is in the scope set", () => {
    expect(
      partitionOf({
        files: [
          fileConfigs({
            team: { ...MATCHING_TEAM, languageOptions: { parser: otherParser }, rules: {} },
            text: "/* eslint-disable */\n",
          }),
        ],
        nativeExceptions: [SUPPRESSION_ENTRY, COMMAND_LINE_OPTION],
      }),
    ).toEqual({
      scopeSet: [
        {
          file: FILE,
          reasons: ["rule-differs", "parser-differs", "directive-text", "suppression-entry", "command-line-option"],
        },
      ],
      rest: [],
    });
  });

  it("puts a file in the scope set when the governance configuration did not resolve for it", () => {
    expect(partitionOf({ files: [{ ...fileConfigs({ team: MATCHING_TEAM }), governance: undefined }] })).toEqual({
      scopeSet: [{ file: FILE, reasons: ["rule-differs", "parser-differs", "language-differs"] }],
      rest: [],
    });
  });

  it("keeps the order of the files it was given", () => {
    expect(
      partitionOf({
        files: [
          { ...fileConfigs({ team: MATCHING_TEAM }), file: OTHER_FILE },
          fileConfigs({ team: undefined }),
        ],
      }),
    ).toEqual({ scopeSet: [{ file: FILE, reasons: ["ignored"] }], rest: [OTHER_FILE] });
  });
});
