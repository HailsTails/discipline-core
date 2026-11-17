import { describe, expect, it, vi } from "vitest";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import type { ConfigFileSearch, EslintPort, QueryInstance } from "./eslint-instance.ts";
import type { OptionEffect, ScriptOption } from "./package-script-scanner.ts";
import { scriptOptionJudge } from "./script-option-effect.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");
const ROOT_PACKAGE = repoPathSchema.parse("package.json");
const NESTED_PACKAGE = repoPathSchema.parse("packages/a/package.json");
const ROOT_FILE = repoPathSchema.parse("src/a.ts");
const NESTED_FILE = repoPathSchema.parse("packages/a/src/b.ts");
const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const optionAt = (request: { readonly location: typeof ROOT_PACKAGE; readonly effect: OptionEffect }): ScriptOption => ({
  ...request,
  exceptions: [],
});

const foundAt = (path: string): ConfigFileSearch => ({ kind: "found", path });

const queryFinding = (request: { readonly configs: Readonly<Record<string, ConfigFileSearch>> }): Pick<QueryInstance, "configFileOf"> => ({
  configFileOf: vi.fn<QueryInstance["configFileOf"]>(({ file }) => Promise.resolve(request.configs[file] ?? { kind: "none" })),
});

const judgeOver = (request: {
  readonly query?: Pick<QueryInstance, "configFileOf">;
  readonly ignoredByPatterns?: EslintPort["ignoredByPatterns"];
}) =>
  scriptOptionJudge({
    query: request.query ?? queryFinding({ configs: {} }),
    eslint: { ignoredByPatterns: request.ignoredByPatterns ?? vi.fn<EslintPort["ignoredByPatterns"]>() },
    path: PATH,
    repoRoot: REPO_ROOT,
    checked: [ROOT_FILE, NESTED_FILE],
  });

describe("scriptOptionJudge, an option that always weakens the run", () => {
  it("weakens without asking ESLint anything", async () => {
    const ignoredByPatterns = vi.fn<EslintPort["ignoredByPatterns"]>();
    await expect(
      judgeOver({ ignoredByPatterns })({ option: optionAt({ location: ROOT_PACKAGE, effect: { kind: "weakens" } }) }),
    ).resolves.toEqual({ outcome: "ok", value: "weakens" });
    expect(ignoredByPatterns).not.toHaveBeenCalled();
  });
});

describe("scriptOptionJudge, a config option", () => {
  it("weakens nothing when it names, from the script's folder, the config the team's ESLint finds for every checked file there", async () => {
    const query = queryFinding({ configs: { [NESTED_FILE]: foundAt("/repo/packages/a/eslint.config.mjs") } });
    await expect(
      judgeOver({ query })({
        option: optionAt({ location: NESTED_PACKAGE, effect: { kind: "names-config", config: "eslint.config.mjs" } }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: "weakens-nothing" });
    expect(vi.mocked(query.configFileOf).mock.calls).toEqual([[{ file: NESTED_FILE }]]);
  });

  it("weakens nothing when it names the root config by a path that climbs out of the script's folder", async () => {
    const query = queryFinding({ configs: { [NESTED_FILE]: foundAt("/repo/eslint.config.mjs") } });
    await expect(
      judgeOver({ query })({
        option: optionAt({ location: NESTED_PACKAGE, effect: { kind: "names-config", config: "../../eslint.config.mjs" } }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: "weakens-nothing" });
  });

  it("weakens when any checked file in the script's folder is governed by another config", async () => {
    const query = queryFinding({
      configs: { [ROOT_FILE]: foundAt("/repo/eslint.config.mjs"), [NESTED_FILE]: foundAt("/repo/packages/a/eslint.config.mjs") },
    });
    await expect(
      judgeOver({ query })({ option: optionAt({ location: ROOT_PACKAGE, effect: { kind: "names-config", config: "eslint.config.mjs" } }) }),
    ).resolves.toEqual({ outcome: "ok", value: "weakens" });
  });

  it("weakens when it names a config other than the one the team's ESLint finds", async () => {
    const query = queryFinding({ configs: { [ROOT_FILE]: foundAt("/repo/eslint.config.mjs"), [NESTED_FILE]: foundAt("/repo/eslint.config.mjs") } });
    await expect(
      judgeOver({ query })({ option: optionAt({ location: ROOT_PACKAGE, effect: { kind: "names-config", config: "alt.config.mjs" } }) }),
    ).resolves.toEqual({ outcome: "ok", value: "weakens" });
  });

  it("weakens when no config is found for a checked file", async () => {
    await expect(
      judgeOver({})({ option: optionAt({ location: ROOT_PACKAGE, effect: { kind: "names-config", config: "eslint.config.mjs" } }) }),
    ).resolves.toEqual({ outcome: "ok", value: "weakens" });
  });

  it("weakens when it names a path outside the repository", async () => {
    await expect(
      judgeOver({})({ option: optionAt({ location: ROOT_PACKAGE, effect: { kind: "names-config", config: "../shared/eslint.config.mjs" } }) }),
    ).resolves.toEqual({ outcome: "ok", value: "weakens" });
  });
});

describe("scriptOptionJudge, an ignore pattern", () => {
  it("weakens nothing when ESLint, from the script's folder, ignores no checked file there by that pattern", async () => {
    const ignoredByPatterns = vi.fn<EslintPort["ignoredByPatterns"]>().mockResolvedValue({ outcome: "ok", value: ["checked"] });
    await expect(
      judgeOver({ ignoredByPatterns })({
        option: optionAt({ location: NESTED_PACKAGE, effect: { kind: "ignores-pattern", pattern: "dist/**" } }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: "weakens-nothing" });
    expect(ignoredByPatterns.mock.calls).toEqual([
      [{ cwd: "/repo/packages/a", patterns: ["dist/**"], paths: ["src/b.ts"] }],
    ]);
  });

  it("weakens when ESLint ignores a checked file by that pattern", async () => {
    const ignoredByPatterns = vi.fn<EslintPort["ignoredByPatterns"]>().mockResolvedValue({ outcome: "ok", value: ["checked", "ignored"] });
    await expect(
      judgeOver({ ignoredByPatterns })({ option: optionAt({ location: ROOT_PACKAGE, effect: { kind: "ignores-pattern", pattern: "packages/**" } }) }),
    ).resolves.toEqual({ outcome: "ok", value: "weakens" });
  });

  it("passes ESLint's failure on the pattern through", async () => {
    const ignoredByPatterns = vi
      .fn<EslintPort["ignoredByPatterns"]>()
      .mockResolvedValue({ outcome: "failed", error: { kind: "tool-failed", detail: "Invalid pattern" } });
    await expect(
      judgeOver({ ignoredByPatterns })({ option: optionAt({ location: ROOT_PACKAGE, effect: { kind: "ignores-pattern", pattern: "[" } }) }),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "tool-failed", detail: "Invalid pattern" } });
  });
});
