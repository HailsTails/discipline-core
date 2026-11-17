import { describe, expect, it, vi } from "vitest";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { ConfigLookup } from "./config-lookup.ts";
import type { ConfigFileSearch, EslintPort, IgnoredState, QueryInstance } from "./eslint-instance.ts";
import { ignoredRootsOf } from "./ignored-roots.ts";

const REPO = absolutePathSchema.parse("/repo");

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" });

const ROOT_CONFIG: ConfigFileSearch = { kind: "found", path: "/repo/eslint.config.mjs" };

const NEAREST: ConfigLookup = { kind: "nearest-to-file" };

const teamQuery = (configs: Readonly<Record<string, ConfigFileSearch>>): QueryInstance => ({
  ignoredState: vi.fn<QueryInstance["ignoredState"]>(),
  ruleState: vi.fn<QueryInstance["ruleState"]>(),
  configFileOf: ({ file }) => Promise.resolve(configs[file]),
});

const eslintAnswering = (request: {
  readonly query: QueryInstance;
  readonly answer: Result<IgnoredState, RunnerFailure>;
}): EslintPort => ({
  createQueryInstance: vi.fn<EslintPort["createQueryInstance"]>().mockReturnValue(request.query),
  createGovernanceInstance: vi.fn<EslintPort["createGovernanceInstance"]>(),
  lintSourceCases: vi.fn<EslintPort["lintSourceCases"]>(),
  ignoredByConfig: vi.fn<EslintPort["ignoredByConfig"]>().mockResolvedValue(request.answer),
});

const ignoredAmong = (request: { readonly eslint: EslintPort; readonly lookup: ConfigLookup; readonly candidates: readonly string[] }) =>
  ignoredRootsOf({
    eslint: request.eslint,
    path,
    repoRoot: REPO,
    lookup: request.lookup,
    candidates: repoPathSchema.array().parse(request.candidates),
  }).then((ignored) => [...ignored]);

const FIXTURE_TEAM = teamQuery({ "fixtures/broken": ROOT_CONFIG, "packages/web": ROOT_CONFIG });

describe("ignoredRootsOf", () => {
  it("names a config root whose folder its governing config ignores, asking that config about the folder", async () => {
    const eslint = eslintAnswering({ query: FIXTURE_TEAM, answer: { outcome: "ok", value: "ignored" } });
    await expect(ignoredAmong({ eslint, lookup: NEAREST, candidates: ["fixtures/broken"] })).resolves.toEqual(["fixtures/broken"]);
    expect(vi.mocked(eslint.ignoredByConfig).mock.calls).toEqual([
      [{ configFile: "/repo/eslint.config.mjs", cwd: "/repo", path: "fixtures/broken/hone-folder-probe" }],
    ]);
  });

  it("does not take packages/web for ignored under a root config holding only { ignores: [\"dist/**\"] }, asking the config that matches the probe rather than the team query that reads every unconfigured path as ignored", async () => {
    const query = teamQuery({ "packages/web": ROOT_CONFIG });
    const eslint = eslintAnswering({ query, answer: { outcome: "ok", value: "checked" } });
    await expect(ignoredAmong({ eslint, lookup: NEAREST, candidates: ["packages/web"] })).resolves.toEqual([]);
    expect({ asked: vi.mocked(eslint.ignoredByConfig).mock.calls, teamAsked: vi.mocked(query.ignoredState).mock.calls }).toEqual({
      asked: [[{ configFile: "/repo/eslint.config.mjs", cwd: "/repo", path: "packages/web/hone-folder-probe" }]],
      teamAsked: [],
    });
  });

  it("leaves out a config root its governing config checks", async () => {
    const eslint = eslintAnswering({ query: FIXTURE_TEAM, answer: { outcome: "ok", value: "checked" } });
    await expect(ignoredAmong({ eslint, lookup: NEAREST, candidates: ["packages/web"] })).resolves.toEqual([]);
  });

  it("leaves out a config root when its governing config cannot answer", async () => {
    const eslint = eslintAnswering({
      query: FIXTURE_TEAM,
      answer: { outcome: "failed", error: { kind: "team-config-unloadable", detail: "Unexpected token ';'" } },
    });
    await expect(ignoredAmong({ eslint, lookup: NEAREST, candidates: ["packages/web"] })).resolves.toEqual([]);
  });

  it("finds governing configs the way the team's run does, from the root config under a root-only lookup", async () => {
    const eslint = eslintAnswering({ query: FIXTURE_TEAM, answer: { outcome: "ok", value: "checked" } });
    await ignoredAmong({
      eslint,
      lookup: { kind: "repository-root", configFile: "/repo/eslint.config.mjs" },
      candidates: ["packages/web"],
    });
    expect(vi.mocked(eslint.createQueryInstance).mock.calls).toEqual([[{ repoRoot: "/repo", configFile: "/repo/eslint.config.mjs" }]]);
  });

  it("builds no ESLint at all when no root is in question", async () => {
    const eslint = eslintAnswering({ query: FIXTURE_TEAM, answer: { outcome: "ok", value: "ignored" } });
    await expect(ignoredAmong({ eslint, lookup: NEAREST, candidates: [] })).resolves.toEqual([]);
    expect(eslint.createQueryInstance).not.toHaveBeenCalled();
  });
});
