import { describe, expect, it } from "vitest";
import type { SourceCase } from "../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { defaultEslintPort } from "../../../tests/eslint-toolchains.ts";
import type { Rule } from "./eslint-instance.ts";
import { eslintPluginModuleSchema } from "./eslint-plugin-schema.ts";
import { functionDisposition, type RuleMeta, type SiteObservers, siteRule } from "./rule-sites.ts";

const RUNNER_ROOT = absolutePathSchema.parse(import.meta.dirname);

const SITE_META: RuleMeta = { type: "problem", schema: [], messages: { site: "site" } };

type ObservedSite = Parameters<NonNullable<SiteObservers[keyof SiteObservers]>>[0];

const reportingRule = (observe: (report: (node: ObservedSite) => void) => SiteObservers): Rule.RuleModule =>
  siteRule({ meta: SITE_META, observe: (context) => observe((node) => context.report({ node, messageId: "site" })) });

const sitesPlugin = eslintPluginModuleSchema.parse({
  default: {
    rules: {
      file: reportingRule((report) => ({ file: report })),
      functions: reportingRule((report) => ({ functions: report })),
      classes: reportingRule((report) => ({ classes: report })),
      calls: reportingRule((report) => ({ calls: report })),
      throws: reportingRule((report) => ({ throws: report })),
      ifs: reportingRule((report) => ({ ifs: report })),
      "variable-declarations": reportingRule((report) => ({ variableDeclarations: report })),
      "calls-and-ifs": reportingRule((report) => ({ calls: report, ifs: report })),
    },
  },
}).default;

const MIXED_SOURCE =
  'void 0;\nfunction declared() {}\nconst expressed = function () {};\nconst arrow = () => 0;\nclass Declared {}\nconst Expressed = class {};\nrun();\nif (ready) {}\nthrow new Error("stop");\n';

const SITE_CASES: readonly { readonly rule: string; readonly expectedLines: readonly number[] }[] = [
  { rule: "file", expectedLines: [1] },
  { rule: "functions", expectedLines: [2, 3, 4] },
  { rule: "classes", expectedLines: [5, 6] },
  { rule: "calls", expectedLines: [7] },
  { rule: "throws", expectedLines: [9] },
  { rule: "ifs", expectedLines: [8] },
  { rule: "variable-declarations", expectedLines: [3, 4, 6] },
  { rule: "calls-and-ifs", expectedLines: [7, 8] },
];

const mixedCase = (request: { readonly expectedLines: readonly number[] }): SourceCase => ({
  name: "one of each site",
  fileName: repoPathSchema.parse("sites.ts"),
  source: MIXED_SOURCE,
  expectedLines: [...request.expectedLines],
});

describe("siteRule through the ESLint runner's lintSourceCases", () => {
  it.each(SITE_CASES)("calls the $rule observers at exactly their sites and no others", async ({ rule, expectedLines }) => {
    expect(
      await defaultEslintPort.lintSourceCases({
        cwd: RUNNER_ROOT,
        plugin: sitesPlugin,
        pluginNamespace: "sites",
        rule,
        options: [],
        cases: [mixedCase({ expectedLines })],
      }),
    ).toEqual({ outcome: "ok", value: [{ caseName: "one of each site", flaggedLines: expectedLines }] });
  });
});

describe("functionDisposition", () => {
  it.each([
    { type: "FunctionDeclaration", disposition: "function" },
    { type: "FunctionExpression", disposition: "function" },
    { type: "ArrowFunctionExpression", disposition: "function" },
    { type: "ClassDeclaration", disposition: "not-function" },
    { type: "CallExpression", disposition: "not-function" },
  ])("reads a $type node as $disposition", ({ type, disposition }) => {
    expect(functionDisposition({ node: { type } })).toBe(disposition);
  });
});
