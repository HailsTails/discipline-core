import { describe, expect, it, vi } from "vitest";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { ConfigFileSearch, EslintPort, IgnoredState, QueryInstance } from "./eslint-instance.ts";
import {
  brokenConfigVerdict,
  cachedGoverningQueries,
  type GoverningLookup,
  type GoverningQueries,
} from "./governing-config.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");
const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" });

const FIXTURE_FILE = repoPathSchema.parse("fixtures/bad/b.ts");
const DEEP_FIXTURE_FILE = repoPathSchema.parse("fixtures/bad/deep/d.ts");
const PACKAGE_FIXTURE_FILE = repoPathSchema.parse("packages/a/fixtures/bad/p.ts");

const BROKEN_FIXTURE_CONFIG = "/repo/fixtures/bad/eslint.config.mjs";
const BROKEN_PACKAGE_FIXTURE_CONFIG = "/repo/packages/a/fixtures/bad/eslint.config.mjs";

const ROOT_CONFIG: ConfigFileSearch = { kind: "found", path: "/repo/eslint.config.mjs" };
const PACKAGE_CONFIG: ConfigFileSearch = { kind: "found", path: "/repo/packages/a/eslint.config.mjs" };

const ROOT_GOVERNING = { governing: { configFile: "/repo/eslint.config.mjs", folder: REPO_ROOT } };
const PACKAGE_GOVERNING = { governing: { configFile: "/repo/packages/a/eslint.config.mjs", folder: absolutePathSchema.parse("/repo/packages/a") } };

const FILE_CHECKED: Result<IgnoredState, RunnerFailure> = { outcome: "ok", value: "checked" };
const FILE_IGNORED: Result<IgnoredState, RunnerFailure> = { outcome: "ok", value: "ignored" };
const CONFIG_UNLOADABLE: Result<IgnoredState, RunnerFailure> = {
  outcome: "failed",
  error: { kind: "team-config-unloadable", detail: "Unexpected token ';'" },
};

const teamQuery = (configs: Readonly<Record<string, ConfigFileSearch>>): QueryInstance => ({
  ignoredState: vi.fn<QueryInstance["ignoredState"]>(),
  ruleState: vi.fn<QueryInstance["ruleState"]>(),
  configFileOf: ({ file }) => Promise.resolve(configs[file]),
});

const governingQuery = (ignored: Result<IgnoredState, RunnerFailure>): QueryInstance => ({
  ignoredState: vi.fn<QueryInstance["ignoredState"]>().mockResolvedValue(ignored),
  ruleState: vi.fn<QueryInstance["ruleState"]>(),
  configFileOf: vi.fn<QueryInstance["configFileOf"]>(),
});

const lookupOver = (request: { readonly query: QueryInstance; readonly governingQueryOf: GoverningQueries }): GoverningLookup => ({
  ...request,
  path: PATH,
  repoRoot: REPO_ROOT,
});

const FIXTURE_TEAM = teamQuery({ "fixtures/bad": ROOT_CONFIG });

const PACKAGE_FIXTURE_TEAM = teamQuery({ "packages/a/fixtures/bad": PACKAGE_CONFIG, "packages/a": ROOT_CONFIG });

describe("brokenConfigVerdict for a broken config whose folder the root config governs", () => {
  it("is ignored-by-governing-config when the root config, built on its own folder, ignores the file", async () => {
    const root = governingQuery(FILE_IGNORED);
    const governingQueryOf = vi.fn<GoverningQueries>().mockReturnValue(root);
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({ query: FIXTURE_TEAM, governingQueryOf }),
      brokenConfig: BROKEN_FIXTURE_CONFIG,
      file: FIXTURE_FILE,
    });
    expect({ verdict, governing: governingQueryOf.mock.calls, probes: vi.mocked(root.ignoredState).mock.calls }).toEqual({
      verdict: "ignored-by-governing-config",
      governing: [[ROOT_GOVERNING]],
      probes: [[{ file: "fixtures/bad/b.ts" }]],
    });
  });

  it("is not-ignored when the root config does not ignore the file", async () => {
    await expect(
      brokenConfigVerdict({
        lookup: lookupOver({ query: FIXTURE_TEAM, governingQueryOf: vi.fn<GoverningQueries>().mockReturnValue(governingQuery(FILE_CHECKED)) }),
        brokenConfig: BROKEN_FIXTURE_CONFIG,
        file: FIXTURE_FILE,
      }),
    ).resolves.toBe("not-ignored");
  });

  it("asks about a file of the same name directly in the broken config's folder, where ESLint decides whether to enter it", async () => {
    const root = governingQuery(FILE_CHECKED);
    await brokenConfigVerdict({
      lookup: lookupOver({ query: FIXTURE_TEAM, governingQueryOf: vi.fn<GoverningQueries>().mockReturnValue(root) }),
      brokenConfig: BROKEN_FIXTURE_CONFIG,
      file: DEEP_FIXTURE_FILE,
    });
    expect(vi.mocked(root.ignoredState).mock.calls).toEqual([[{ file: "fixtures/bad/d.ts" }]]);
  });
});

describe("brokenConfigVerdict for a broken config below an intermediate config", () => {
  it("asks the intermediate config on its own folder and stops when it ignores the file", async () => {
    const intermediate = governingQuery(FILE_IGNORED);
    const governingQueryOf = vi.fn<GoverningQueries>().mockReturnValueOnce(intermediate);
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({ query: PACKAGE_FIXTURE_TEAM, governingQueryOf }),
      brokenConfig: BROKEN_PACKAGE_FIXTURE_CONFIG,
      file: PACKAGE_FIXTURE_FILE,
    });
    expect({ verdict, governing: governingQueryOf.mock.calls, probes: vi.mocked(intermediate.ignoredState).mock.calls }).toEqual({
      verdict: "ignored-by-governing-config",
      governing: [[PACKAGE_GOVERNING]],
      probes: [[{ file: "fixtures/bad/p.ts" }]],
    });
  });

  it("asks the root config about the intermediate config's folder when the intermediate config does not ignore the file", async () => {
    const root = governingQuery(FILE_IGNORED);
    const governingQueryOf = vi.fn<GoverningQueries>().mockReturnValueOnce(governingQuery(FILE_CHECKED)).mockReturnValueOnce(root);
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({ query: PACKAGE_FIXTURE_TEAM, governingQueryOf }),
      brokenConfig: BROKEN_PACKAGE_FIXTURE_CONFIG,
      file: PACKAGE_FIXTURE_FILE,
    });
    expect({ verdict, governing: governingQueryOf.mock.calls, probes: vi.mocked(root.ignoredState).mock.calls }).toEqual({
      verdict: "ignored-by-governing-config",
      governing: [[PACKAGE_GOVERNING], [ROOT_GOVERNING]],
      probes: [[{ file: "packages/a/p.ts" }]],
    });
  });

  it("reads past an intermediate config that itself fails to load, to the config governing its folder", async () => {
    const governingQueryOf = vi
      .fn<GoverningQueries>()
      .mockReturnValueOnce(governingQuery(CONFIG_UNLOADABLE))
      .mockReturnValueOnce(governingQuery(FILE_IGNORED));
    await expect(
      brokenConfigVerdict({
        lookup: lookupOver({ query: PACKAGE_FIXTURE_TEAM, governingQueryOf }),
        brokenConfig: BROKEN_PACKAGE_FIXTURE_CONFIG,
        file: PACKAGE_FIXTURE_FILE,
      }),
    ).resolves.toBe("ignored-by-governing-config");
  });

  it("is not-ignored when neither the intermediate nor the root config ignores the file", async () => {
    const governingQueryOf = vi
      .fn<GoverningQueries>()
      .mockReturnValueOnce(governingQuery(CONFIG_UNLOADABLE))
      .mockReturnValueOnce(governingQuery(FILE_CHECKED));
    await expect(
      brokenConfigVerdict({
        lookup: lookupOver({ query: PACKAGE_FIXTURE_TEAM, governingQueryOf }),
        brokenConfig: BROKEN_PACKAGE_FIXTURE_CONFIG,
        file: PACKAGE_FIXTURE_FILE,
      }),
    ).resolves.toBe("not-ignored");
  });
});

describe("brokenConfigVerdict where no config governs above the broken one", () => {
  it("asks nothing when the broken config is the repository root's", async () => {
    const query = { ...teamQuery({}), configFileOf: vi.fn<QueryInstance["configFileOf"]>() };
    const governingQueryOf = vi.fn<GoverningQueries>();
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({ query, governingQueryOf }),
      brokenConfig: "/repo/eslint.config.mjs",
      file: repoPathSchema.parse("src/a.ts"),
    });
    expect({ verdict, lookups: query.configFileOf.mock.calls, governing: governingQueryOf.mock.calls }).toEqual({
      verdict: "not-ignored",
      lookups: [],
      governing: [],
    });
  });

  it("never asks a config above the repository root", async () => {
    const governingQueryOf = vi.fn<GoverningQueries>();
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({ query: teamQuery({ "fixtures/bad": { kind: "found", path: "/eslint.config.mjs" } }), governingQueryOf }),
      brokenConfig: BROKEN_FIXTURE_CONFIG,
      file: FIXTURE_FILE,
    });
    expect({ verdict, governing: governingQueryOf.mock.calls }).toEqual({ verdict: "not-ignored", governing: [] });
  });

  it("never asks the broken config itself, as a lookup on one fixed config returns", async () => {
    const governingQueryOf = vi.fn<GoverningQueries>();
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({ query: teamQuery({ "fixtures/bad": { kind: "found", path: BROKEN_FIXTURE_CONFIG } }), governingQueryOf }),
      brokenConfig: BROKEN_FIXTURE_CONFIG,
      file: FIXTURE_FILE,
    });
    expect({ verdict, governing: governingQueryOf.mock.calls }).toEqual({ verdict: "not-ignored", governing: [] });
  });

  it("is not-ignored when no config governs the broken config's folder", async () => {
    const governingQueryOf = vi.fn<GoverningQueries>();
    const verdict = await brokenConfigVerdict({
      lookup: lookupOver({ query: teamQuery({ "fixtures/bad": { kind: "none" } }), governingQueryOf }),
      brokenConfig: BROKEN_FIXTURE_CONFIG,
      file: FIXTURE_FILE,
    });
    expect({ verdict, governing: governingQueryOf.mock.calls }).toEqual({ verdict: "not-ignored", governing: [] });
  });
});

describe("cachedGoverningQueries", () => {
  it("builds one query instance per governing config, on that config's folder, and reuses it", () => {
    const root = governingQuery(FILE_IGNORED);
    const intermediate = governingQuery(FILE_IGNORED);
    const createQueryInstance = vi.fn<EslintPort["createQueryInstance"]>().mockReturnValueOnce(root).mockReturnValueOnce(intermediate);
    const governingQueryOf = cachedGoverningQueries({
      eslint: { createQueryInstance, createGovernanceInstance: vi.fn(), lintSourceCases: vi.fn() },
    });
    const queries = [governingQueryOf(ROOT_GOVERNING), governingQueryOf(PACKAGE_GOVERNING), governingQueryOf(ROOT_GOVERNING)];
    expect({ queries, built: createQueryInstance.mock.calls }).toEqual({
      queries: [root, intermediate, root],
      built: [
        [{ repoRoot: "/repo", configFile: "/repo/eslint.config.mjs" }],
        [{ repoRoot: "/repo/packages/a", configFile: "/repo/packages/a/eslint.config.mjs" }],
      ],
    });
  });

  it("builds nothing until a governing config is asked for", () => {
    const createQueryInstance = vi.fn<EslintPort["createQueryInstance"]>();
    cachedGoverningQueries({ eslint: { createQueryInstance, createGovernanceInstance: vi.fn(), lintSourceCases: vi.fn() } });
    expect(createQueryInstance.mock.calls).toEqual([]);
  });
});
