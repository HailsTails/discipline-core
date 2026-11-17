import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import {
  commandLineOptionsOf,
  eslintInvocationsOf,
  type OptionEffect,
  type SelectedRule,
  scanPackageJson,
  scriptCommandsOf,
  suppressionsLocationValuesOf,
} from "./package-script-scanner.ts";

const classSyntax = clauseAddressSchema.parse("CD-14#class-syntax");
const noTmpFiles = clauseAddressSchema.parse("probe/PD-1#no-tmp-files");
const noClassAuthoring = "hone/no-class-authoring";
const rootPackageJson = repoPathSchema.parse("package.json");
const nestedPackageJson = repoPathSchema.parse("packages/a/package.json");

const WEAKENS: OptionEffect = { kind: "weakens" };

type OptionRow = { readonly options: readonly string[]; readonly option: string; readonly effect: OptionEffect };

const classRule: SelectedRule = { ruleId: noClassAuthoring, clause: classSyntax };
const tmpRule: SelectedRule = { ruleId: "probe-lint/no-tmp-files", clause: noTmpFiles };

describe("scriptCommandsOf", () => {
  it("splits a command into tokens on runs of whitespace", () => {
    expect(scriptCommandsOf({ script: "eslint  src\t--max-warnings 0" })).toEqual({
      outcome: "ok",
      value: [["eslint", "src", "--max-warnings", "0"]],
    });
  });

  it("keeps single- and double-quoted spans whole and removes their quotes", () => {
    expect(
      scriptCommandsOf({
        script: `eslint --rule 'hone/no-class-authoring: off' --ignore-pattern "dist/**"`,
      }),
    ).toEqual({
      outcome: "ok",
      value: [["eslint", "--rule", "hone/no-class-authoring: off", "--ignore-pattern", "dist/**"]],
    });
  });

  it("splits commands at &&, ||, ; and | standing alone", () => {
    expect(scriptCommandsOf({ script: "tsc && eslint . || echo failed ; echo done | cat" })).toEqual({
      outcome: "ok",
      value: [["tsc"], ["eslint", "."], ["echo", "failed"], ["echo", "done"], ["cat"]],
    });
  });

  it("does not split at an operator inside quotes", () => {
    expect(scriptCommandsOf({ script: `echo "a && b; c | d" 'e || f'` })).toEqual({
      outcome: "ok",
      value: [["echo", "a && b; c | d", "e || f"]],
    });
  });
});

describe("eslintInvocationsOf", () => {
  it.each([
    { command: ["eslint", "src", "--quiet"], options: ["src", "--quiet"] },
    { command: ["npx", "eslint", "src"], options: ["src"] },
    { command: ["pnpm", "exec", "eslint", "src"], options: ["src"] },
    { command: ["./node_modules/.bin/eslint", "src"], options: ["src"] },
  ])("recognises $command as an invocation whose options follow the eslint token", ({ command, options }) => {
    expect(eslintInvocationsOf({ commands: [command] })).toEqual([{ options }]);
  });

  it.each([
    ["eslint-plugin-check", "src"],
    ["prettier", "--check", "eslint.config.mjs"],
  ])("does not recognise %s as an invocation", (...command) => {
    expect(eslintInvocationsOf({ commands: [command] })).toEqual([]);
  });

  it("reads options a package manager forwards after -- the same way", () => {
    expect(
      eslintInvocationsOf({
        commands: [["pnpm", "exec", "eslint", "src", "--", "--rule", "hone/no-class-authoring: off"]],
      }),
    ).toEqual([{ options: ["src", "--rule", "hone/no-class-authoring: off"] }]);
  });

  it("finds each invocation among a script's other commands, counting any command with an eslint token", () => {
    expect(
      eslintInvocationsOf({ commands: [["cd", "sub"], ["eslint", "src"], ["echo", "eslint"]] }),
    ).toEqual([{ options: ["src"] }, { options: [] }]);
  });
});

describe("commandLineOptionsOf", () => {
  it("reports --rule in space form when its value names a selected rule id", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["src", "--rule", "hone/no-class-authoring: off"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([
      { option: "--rule hone/no-class-authoring: off", ruleIds: [noClassAuthoring], effect: WEAKENS },
    ]);
  });

  it("reports --rule in = form when its value names a selected rule id", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule=hone/no-class-authoring: off"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([
      { option: "--rule=hone/no-class-authoring: off", ruleIds: [noClassAuthoring], effect: WEAKENS },
    ]);
  });

  it("matches a selected rule id after a comma and spaces in the --rule value", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule", "no-console: off,   hone/no-class-authoring : off"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([
      {
        option: "--rule no-console: off,   hone/no-class-authoring : off",
        ruleIds: [noClassAuthoring],
        effect: WEAKENS,
      },
    ]);
  });

  it("names only the selected rule ids a --rule value names", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule", "probe-lint/no-tmp-files: off"] },
        selectedRuleIds: [noClassAuthoring, "probe-lint/no-tmp-files"],
      }),
    ).toEqual([{ option: "--rule probe-lint/no-tmp-files: off", ruleIds: ["probe-lint/no-tmp-files"], effect: WEAKENS }]);
  });

  it.each([
    "hone/no-class-authoring-x: off",
    "no-console: off",
    "discipline: off",
  ])("does not report --rule whose value %s names no selected rule id as a whole id", (ruleValue) => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule", ruleValue] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([]);
  });

  it.each([
    [["--suppress-rule", "hone/no-class-authoring"], "--suppress-rule hone/no-class-authoring"],
    [["--suppress-rule=hone/no-class-authoring"], "--suppress-rule=hone/no-class-authoring"],
    [["--suppress-rule", "no-console,hone/no-class-authoring"], "--suppress-rule no-console,hone/no-class-authoring"],
  ])("reports %j when it names a selected rule id", (options, option) => {
    expect(
      commandLineOptionsOf({ invocation: { options }, selectedRuleIds: [noClassAuthoring] }),
    ).toEqual([{ option, ruleIds: [noClassAuthoring], effect: WEAKENS }]);
  });

  it("does not report --suppress-rule naming a rule id that only extends a selected one", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--suppress-rule", "hone/no-class-authoring-x"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([]);
  });

  it.each<OptionRow>([
    { options: ["--suppress-all"], option: "--suppress-all", effect: WEAKENS },
    { options: ["--ignore-pattern", "dist/**"], option: "--ignore-pattern dist/**", effect: { kind: "ignores-pattern", pattern: "dist/**" } },
    { options: ["--ignore-pattern=dist/**"], option: "--ignore-pattern=dist/**", effect: { kind: "ignores-pattern", pattern: "dist/**" } },
    { options: ["-c", "alt.config.mjs"], option: "-c alt.config.mjs", effect: { kind: "names-config", config: "alt.config.mjs" } },
    { options: ["--config", "alt.config.mjs"], option: "--config alt.config.mjs", effect: { kind: "names-config", config: "alt.config.mjs" } },
    { options: ["--config=alt.config.mjs"], option: "--config=alt.config.mjs", effect: { kind: "names-config", config: "alt.config.mjs" } },
    { options: ["--no-config-lookup"], option: "--no-config-lookup", effect: WEAKENS },
    { options: ["--parser", "espree"], option: "--parser espree", effect: WEAKENS },
    { options: ["--parser-options", "ecmaVersion:2020"], option: "--parser-options ecmaVersion:2020", effect: WEAKENS },
    { options: ["--plugin", "local"], option: "--plugin local", effect: WEAKENS },
  ])("reports $option for every selected rule id, with the effect it is judged by", ({ options, option, effect }) => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["src", ...options] },
        selectedRuleIds: [noClassAuthoring, "probe-lint/no-tmp-files"],
      }),
    ).toEqual([{ option, ruleIds: [noClassAuthoring, "probe-lint/no-tmp-files"], effect }]);
  });

  it.each<OptionRow>([
    { options: ["-c=alt.config.mjs"], option: "-c=alt.config.mjs", effect: { kind: "names-config", config: "alt.config.mjs" } },
    { options: ["--parser=espree"], option: "--parser=espree", effect: WEAKENS },
    { options: ["--parser-options=ecmaVersion:2020"], option: "--parser-options=ecmaVersion:2020", effect: WEAKENS },
    { options: ["--plugin=local"], option: "--plugin=local", effect: WEAKENS },
  ])("reports the = form $option for every selected rule id, with the effect it is judged by", ({ options, option, effect }) => {
    expect(
      commandLineOptionsOf({
        invocation: { options },
        selectedRuleIds: [noClassAuthoring, "probe-lint/no-tmp-files"],
      }),
    ).toEqual([{ option, ruleIds: [noClassAuthoring, "probe-lint/no-tmp-files"], effect }]);
  });
});

describe("suppressionsLocationValuesOf", () => {
  it("reads --suppressions-location in space form", () => {
    expect(
      suppressionsLocationValuesOf({
        invocation: { options: ["src", "--suppressions-location", "lint-suppressions.json"] },
      }),
    ).toEqual(["lint-suppressions.json"]);
  });

  it("reads --suppressions-location in = form", () => {
    expect(
      suppressionsLocationValuesOf({
        invocation: { options: ["--suppressions-location=lint-suppressions.json", "src"] },
      }),
    ).toEqual(["lint-suppressions.json"]);
  });

  it("reads nothing from an invocation with no --suppressions-location", () => {
    expect(suppressionsLocationValuesOf({ invocation: { options: ["src", "--quiet"] } })).toEqual([]);
  });
});

describe("scanPackageJson, whether the script's own folder settles an option's effect", () => {
  it.each([
    { script: "eslint --ignore-pattern 'legacy/**' .", settlement: "settled" },
    { script: "eslint -c eslint.config.mjs src", settlement: "settled" },
    { script: "pnpm exec eslint --ignore-pattern 'legacy/**' src", settlement: "settled" },
    { script: "pnpm exec eslint -c eslint.config.mjs .", settlement: "settled" },
    { script: "npx eslint --ignore-pattern dist --cache .", settlement: "settled" },
    { script: "yarn eslint -c eslint.config.mjs .", settlement: "settled" },
    { script: "npm exec -- eslint -c eslint.config.mjs .", settlement: "settled" },
    { script: "TIMING=1 eslint -c eslint.config.mjs .", settlement: "settled" },
    { script: "(cd src && eslint --ignore-pattern 'legacy/**' .)", settlement: "unsettled" },
    { script: "env --chdir=src eslint --ignore-pattern 'legacy/**' .", settlement: "unsettled" },
    { script: "tsc && eslint -c eslint.config.mjs .", settlement: "unsettled" },
    { script: "ROOT=$PWD eslint -c eslint.config.mjs .", settlement: "unsettled" },
    { script: "cd src && eslint --ignore-pattern 'legacy/**' .", settlement: "unsettled" },
    { script: "pushd src; eslint --ignore-pattern 'legacy/**' .", settlement: "unsettled" },
    { script: "pnpm -C src exec eslint --ignore-pattern 'legacy/**' .", settlement: "unsettled" },
    { script: "npm --prefix=src exec eslint --ignore-pattern 'legacy/**' .", settlement: "unsettled" },
    { script: "pnpm --filter web exec eslint --ignore-pattern 'legacy/**' .", settlement: "unsettled" },
    { script: 'eslint --ignore-pattern "$LEGACY" .', settlement: "unsettled" },
    { script: "eslint --ignore-pattern `cat legacy.txt` .", settlement: "unsettled" },
    { script: "eslint --ignore-pattern '$LEGACY' .", settlement: "unsettled" },
    { script: "eslint --ignore-pattern legacy/** .", settlement: "unsettled" },
    { script: "eslint --ignore-pattern 'legacy/**' ..", settlement: "unsettled" },
    { script: "eslint --ignore-pattern '../legacy/**' .", settlement: "unsettled" },
    { script: "eslint --ignore-pattern 'legacy/**' /repo/src", settlement: "unsettled" },
    { script: "eslint --ignore-pattern 'legacy/**' ~/src", settlement: "unsettled" },
  ])("marks the option in $script $settlement", ({ script, settlement }) => {
    expect(
      scanPackageJson({ path: rootPackageJson, text: JSON.stringify({ scripts: { lint: script } }), selectedRules: [classRule] }),
    ).toMatchObject({ outcome: "ok", value: { scriptOptions: [{ settlement }] } });
  });
});

describe("scanPackageJson", () => {
  it("reports malformed JSON as tool-failed", () => {
    expect(
      scanPackageJson({ path: rootPackageJson, text: `{ "scripts": `, selectedRules: [classRule] }),
    ).toMatchObject({ outcome: "failed", error: { kind: "tool-failed" } });
  });

  it("finds nothing in a package.json with no scripts", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ name: "app" }),
        selectedRules: [classRule],
      }),
    ).toEqual({ outcome: "ok", value: { scriptOptions: [], suppressionsLocations: [] } });
  });

  it("reports a script with an unterminated quote as tool-failed naming the script", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { "lint:strict": "eslint --rule 'x: off" } }),
        selectedRules: [classRule],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "tool-failed", detail: expect.stringContaining("lint:strict") },
    });
  });

  it("reports a dormant --rule turning a selected rule off as a command-line-option at the declaring package.json", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { lint: "eslint --rule 'hone/no-class-authoring: off' src" } }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        scriptOptions: [
          {
            location: "package.json",
            effect: WEAKENS,
            settlement: "settled",
            exceptions: [
              {
                kind: "command-line-option",
                clause: classSyntax,
                location: "package.json",
                script: "lint",
                option: "--rule hone/no-class-authoring: off",
              },
            ],
          },
        ],
        suppressionsLocations: [],
      },
    });
  });

  it("does not report a --rule for a rule id that merely extends a selected one", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { lint: "eslint --rule 'hone/no-class-authoring-x: off' src" } }),
        selectedRules: [classRule],
      }),
    ).toEqual({ outcome: "ok", value: { scriptOptions: [], suppressionsLocations: [] } });
  });

  it("reports an every-clause option once per selected clause", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { lint: "eslint -c alt.config.mjs src" } }),
        selectedRules: [classRule, tmpRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        scriptOptions: [
          {
            location: "package.json",
            effect: { kind: "names-config", config: "alt.config.mjs" },
            settlement: "settled",
            exceptions: [
              {
                kind: "command-line-option",
                clause: classSyntax,
                location: "package.json",
                script: "lint",
                option: "-c alt.config.mjs",
              },
              {
                kind: "command-line-option",
                clause: noTmpFiles,
                location: "package.json",
                script: "lint",
                option: "-c alt.config.mjs",
              },
            ],
          },
        ],
        suppressionsLocations: [],
      },
    });
  });

  it("ignores an option outside a recognised ESLint invocation", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { format: "prettier --config .prettierrc --ignore-pattern dist ." } }),
        selectedRules: [classRule],
      }),
    ).toEqual({ outcome: "ok", value: { scriptOptions: [], suppressionsLocations: [] } });
  });

  it("reads --suppressions-location in space and = forms from a root package.json", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({
          scripts: {
            lint: "eslint --suppressions-location lint-suppressions.json src",
            "lint:ci": "eslint --suppressions-location=ci/suppressions.json src",
          },
        }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        scriptOptions: [],
        suppressionsLocations: [
          { location: "lint-suppressions.json", script: "lint" },
          { location: "ci/suppressions.json", script: "lint:ci" },
        ],
      },
    });
  });

  it("resolves a nested script's --suppressions-location ../x against the declaring package.json's directory", () => {
    expect(
      scanPackageJson({
        path: nestedPackageJson,
        text: JSON.stringify({ scripts: { lint: "eslint --suppressions-location ../x/suppressions.json src" } }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        scriptOptions: [],
        suppressionsLocations: [{ location: "packages/x/suppressions.json", script: "lint" }],
      },
    });
  });
});
