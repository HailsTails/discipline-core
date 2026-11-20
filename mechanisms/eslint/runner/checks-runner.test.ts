import { assert, describe, expect, it, vi } from "vitest";
import { createDefaultFileRemovalPort } from "../../../core/platform-ports/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../../../core/platform-ports/path-port.ts";
import { symptomCatalogueOf } from "../../../core/symptom-catalogue/symptom-catalogue-wire.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import SYMPTOMS from "../../../rules/typescript/symptoms.json" with { type: "json" };
import ESLINT_CD_14_PIECE from "../CD-14/piece.json" with { type: "json" };
import { CHECKS_PROJECTION_PATH, checksProjectionText } from "./checks-projection.ts";
import type { ChecksRepository } from "./checks-repository.ts";
import type { ChecksRunRequest } from "./checks-run-types.ts";
import { checksRunnerOver } from "./checks-runner.ts";
import type { ChecksRunnerPorts } from "./checks-ports.ts";
import { SILENT_BOUNDARY } from "../../../tests/eslint-major-boundary-stub.ts";
import type { RuleState } from "./eslint-config-schema.ts";
import type { EslintPort, GovernanceInstance, QueryInstance } from "./eslint-instance.ts";
import type { CurrentProjection, ProjectionFiles } from "./projection.ts";

const eslint: EslintPort = {
  boundary: SILENT_BOUNDARY,
  createQueryInstance: vi.fn<EslintPort["createQueryInstance"]>(),
  createGovernanceInstance: vi.fn<EslintPort["createGovernanceInstance"]>(),
  ignoredByConfig: vi.fn<EslintPort["ignoredByConfig"]>(),
  ignoredByPatterns: vi.fn<EslintPort["ignoredByPatterns"]>(),
  lintSourceCases: vi.fn<EslintPort["lintSourceCases"]>(),
};

const path = createDefaultPathPort({});

const modules: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };

const runner = checksRunnerOver({
  ports: { repositoryAt: vi.fn<ChecksRunnerPorts["repositoryAt"]>(), coreInstall: vi.fn<ChecksRunnerPorts["coreInstall"]>(), modules, path, eslint },
  platform: { fileText: createDefaultFileTextPort({}), fileRemoval: createDefaultFileRemovalPort({}), modules, path, eslint, moduleExtension: ".ts" },
});

const REQUEST: ChecksRunRequest = {
  repoRoot: absolutePathSchema.parse("/repo"),
  installRoot: absolutePathSchema.parse("/install"),
  files: [repoPathSchema.parse("src/a.ts")],
  trackedPaths: [repoPathSchema.parse("src/a.ts")],
  checks: [],
  bindings: [],
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: undefined,
};

const NOT_READY_DECLARED = { outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", cause: "declared-roots", paths: ["packages/web"] } } };

const NOT_READY_NESTED = { outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", cause: "nested-repositories", paths: ["vendor/lib"] } } };

describe("checksRunnerOver", () => {
  it("is not ready for a repository that declares ESLint config roots, before touching any port", async () => {
    expect(await runner.run({ ...REQUEST, declaredConfigRoots: [repoPathSchema.parse("packages/web")] })).toEqual(NOT_READY_DECLARED);
  });

  it("is not ready for a repository holding a nested repository with files to check", async () => {
    expect(
      await runner.run({
        ...REQUEST,
        files: [repoPathSchema.parse("vendor/lib/src/a.ts")],
        trackedPaths: [repoPathSchema.parse("vendor/lib/hone.config.json"), repoPathSchema.parse("vendor/lib/src/a.ts")],
      }),
    ).toEqual(NOT_READY_NESTED);
  });

  it("names the nested repository, and not its own lint config as a package config of this one, when that repository holds one", async () => {
    expect(
      await runner.run({
        ...REQUEST,
        files: [repoPathSchema.parse("vendor/lib/src/a.ts")],
        trackedPaths: [
          repoPathSchema.parse("vendor/lib/hone.config.json"),
          repoPathSchema.parse("vendor/lib/eslint.config.mjs"),
          repoPathSchema.parse("vendor/lib/src/a.ts"),
        ],
      }),
    ).toEqual(NOT_READY_NESTED);
  });

  it("does not report a nested repository's lint config as a package config of this one when the nested repository holds no file to check", async () => {
    const outcome = await runner.run({
      ...REQUEST,
      files: [],
      trackedPaths: [repoPathSchema.parse("vendor/lib/hone.config.json"), repoPathSchema.parse("vendor/lib/eslint.config.mjs")],
    });
    expect(outcome).toEqual({ outcome: "ok", value: expect.anything() });
  });

  it("does not count a subfolder config as a root when the repository declares a repository-root lookup", async () => {
    const outcome = await runner.run({
      ...REQUEST,
      declaredConfigLookup: "repository-root",
      trackedPaths: [repoPathSchema.parse("eslint.config.mjs"), repoPathSchema.parse("packages/web/eslint.config.mjs"), repoPathSchema.parse("src/a.ts")],
    });
    expect(outcome).toEqual({ outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current" } });
  });

  it("reports a current projection and no findings when no check runs on ESLint", async () => {
    expect(await runner.run(REQUEST)).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current" },
    });
  });
});

const REAL_INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../..`);

const SCRATCH_REPO_ROOT = absolutePathSchema.parse(`${REAL_INSTALL_ROOT}/artefacts/scratch`);

const SYMPTOM_CATALOGUE = symptomCatalogueOf({ document: SYMPTOMS });

assert(SYMPTOM_CATALOGUE.outcome === "ok", "the shipped symptom catalogue reads");

const CLASS_PROJECTED = { symptom: "authored-class-or-this", check: "class-keyword", ruleId: "hone/authored-class-or-this/class-keyword", options: [] };

const CURRENT_PROJECTION_TEXT = checksProjectionText({ pluginImport: "../../api/eslint-plugin.ts", checks: [CLASS_PROJECTED], answered: [] });

const CLASS_BINDINGS: ChecksRunRequest["bindings"] = [
  {
    mechanism: "eslint",
    clause: {
      address: clauseAddressSchema.parse("CD-14#class-syntax"),
      pieceRoot: `${REAL_INSTALL_ROOT}/mechanisms/eslint/CD-14`,
      settings: ESLINT_CD_14_PIECE.clauses[0].settings,
    },
  },
];

const SELECTING_THE_CLASS_CHECK: ChecksRunRequest = {
  repoRoot: SCRATCH_REPO_ROOT,
  installRoot: REAL_INSTALL_ROOT,
  files: [repoPathSchema.parse("kept.ts")],
  trackedPaths: [repoPathSchema.parse("kept.ts")],
  checks: SYMPTOM_CATALOGUE.value.checks,
  bindings: CLASS_BINDINGS,
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: "nearest-to-file",
};

const CONFIGURED_ON: RuleState = { state: "configured", severity: 2, options: [] };

const RULE_ABSENT: RuleState = { state: "rule-absent" };

const PROJECTION_WRITTEN_AS_PROJECT_WOULD: CurrentProjection = { presence: "present", text: CURRENT_PROJECTION_TEXT };

const PROJECTION_THAT_DIFFERS: CurrentProjection = { presence: "present", text: `${CURRENT_PROJECTION_TEXT}\n` };

const PROJECTION_NOT_WRITTEN: CurrentProjection = { presence: "absent" };

const rootOnly = (current: CurrentProjection): ReadonlyMap<RepoPath, CurrentProjection> => new Map([[CHECKS_PROJECTION_PATH, current]]);

const projectionFilesHolding = (currents: ReadonlyMap<RepoPath, CurrentProjection>): ProjectionFiles => ({
  currentOf: vi.fn<ProjectionFiles["currentOf"]>().mockReturnValue({ outcome: "ok", value: currents }),
  writeAt: vi.fn<ProjectionFiles["writeAt"]>(),
  removeAt: vi.fn<ProjectionFiles["removeAt"]>(),
});

const repositoryHolding = (currents: ReadonlyMap<RepoPath, CurrentProjection>): ChecksRepository => ({
  projectionFiles: projectionFilesHolding(currents),
  packageScriptsAt: vi.fn<ChecksRepository["packageScriptsAt"]>(),
  suppressionsAt: vi.fn<ChecksRepository["suppressionsAt"]>(),
  sourceLines: vi.fn<ChecksRepository["sourceLines"]>(),
});

const queryInstanceOver = (ruleState: RuleState): QueryInstance => ({
  ignoredState: vi.fn<QueryInstance["ignoredState"]>().mockResolvedValue({ outcome: "ok", value: "checked" }),
  ruleState: vi.fn<QueryInstance["ruleState"]>().mockResolvedValue({ outcome: "ok", value: ruleState }),
  configFileOf: vi.fn<QueryInstance["configFileOf"]>(),
});

const lintingNothing = (): GovernanceInstance => ({
  lintFiles: vi.fn<GovernanceInstance["lintFiles"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const runnerOverProjection = (stubs: { readonly currents: ReadonlyMap<RepoPath, CurrentProjection>; readonly ruleState: RuleState; readonly governance: GovernanceInstance }) => {
  const realModules = createDefaultModuleLoaderPort({});
  const stubbedEslint: EslintPort = {
    boundary: SILENT_BOUNDARY,
    createQueryInstance: vi.fn<EslintPort["createQueryInstance"]>().mockReturnValue(queryInstanceOver(stubs.ruleState)),
    createGovernanceInstance: vi.fn<EslintPort["createGovernanceInstance"]>().mockReturnValue(stubs.governance),
    ignoredByConfig: vi.fn<EslintPort["ignoredByConfig"]>(),
    ignoredByPatterns: vi.fn<EslintPort["ignoredByPatterns"]>(),
    lintSourceCases: vi.fn<EslintPort["lintSourceCases"]>(),
  };
  return checksRunnerOver({
    ports: {
      repositoryAt: vi.fn<ChecksRunnerPorts["repositoryAt"]>().mockReturnValue(repositoryHolding(stubs.currents)),
      coreInstall: vi.fn<ChecksRunnerPorts["coreInstall"]>().mockReturnValue({ outcome: "ok", value: { form: "source" } }),
      modules: realModules,
      path,
      eslint: stubbedEslint,
    },
    platform: { fileText: createDefaultFileTextPort({}), fileRemoval: createDefaultFileRemovalPort({}), modules: realModules, path, eslint: stubbedEslint, moduleExtension: ".ts" },
  });
};

describe("checksRunnerOver, reporting the state of hone.eslint.mjs from the repository's reader", () => {
  it("reports a missing projection, and lints nothing, when hone.eslint.mjs is not written", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({ currents: rootOnly(PROJECTION_NOT_WRITTEN), ruleState: CONFIGURED_ON, governance }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "missing" } },
      linted: [],
    });
  });

  it("reports an out-of-date projection, and still lints the files, when hone.eslint.mjs differs from what project would write", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({ currents: rootOnly(PROJECTION_THAT_DIFFERS), ruleState: CONFIGURED_ON, governance }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "out-of-date" } },
      linted: [[{ files: SELECTING_THE_CLASS_CHECK.files }]],
    });
  });

  it("reports the projection current, and lints the files, when hone.eslint.mjs is what project would write and the team's config enables the check", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({ currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD), ruleState: CONFIGURED_ON, governance }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current" } },
      linted: [[{ files: SELECTING_THE_CLASS_CHECK.files }]],
    });
  });

  it("reports the projection not included, and lints nothing, when the team's config leaves the check's rule out of a checked file", async () => {
    const governance = lintingNothing();
    const outcome = await runnerOverProjection({ currents: rootOnly(PROJECTION_WRITTEN_AS_PROJECT_WOULD), ruleState: RULE_ABSENT, governance }).run(SELECTING_THE_CLASS_CHECK);
    expect({ outcome, linted: vi.mocked(governance.lintFiles).mock.calls }).toEqual({
      outcome: { outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "not-included" } },
      linted: [],
    });
  });
});

const PACKAGE_SLICE_PATH = repoPathSchema.parse("packages/web/hone.eslint.mjs");

const PACKAGE_PROJECTION_TEXT = checksProjectionText({ pluginImport: "../../../../api/eslint-plugin.ts", checks: [CLASS_PROJECTED], answered: [] });

const PACKAGE_PROJECTION_PRESENT: CurrentProjection = { presence: "present", text: PACKAGE_PROJECTION_TEXT };

const WITH_A_PACKAGE_CONFIG: ChecksRunRequest = {
  ...SELECTING_THE_CLASS_CHECK,
  trackedPaths: [repoPathSchema.parse("kept.ts"), repoPathSchema.parse("packages/web/eslint.config.mjs")],
};

const slicesHolding = (request: { readonly root: CurrentProjection; readonly web: CurrentProjection }): ReadonlyMap<RepoPath, CurrentProjection> =>
  new Map([
    [CHECKS_PROJECTION_PATH, request.root],
    [PACKAGE_SLICE_PATH, request.web],
  ]);

const runOverSlices = (request: { readonly root: CurrentProjection; readonly web: CurrentProjection }) =>
  runnerOverProjection({ currents: slicesHolding(request), ruleState: CONFIGURED_ON, governance: lintingNothing() }).run(WITH_A_PACKAGE_CONFIG);

describe("checksRunnerOver, over a repository holding a package eslint.config.*", () => {
  it("reports the projection current when the root file and the package's file both hold what project writes", async () => {
    expect(await runOverSlices({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PACKAGE_PROJECTION_PRESENT })).toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("reports the projection out of date when only the package's file differs", async () => {
    expect(await runOverSlices({ root: PROJECTION_WRITTEN_AS_PROJECT_WOULD, web: PROJECTION_THAT_DIFFERS })).toMatchObject({ outcome: "ok", value: { projection: "out-of-date" } });
  });

  it("reports the projection missing, rather than out of date, when the package's file is not written and the root file differs", async () => {
    expect(await runOverSlices({ root: PROJECTION_THAT_DIFFERS, web: PROJECTION_NOT_WRITTEN })).toMatchObject({ outcome: "ok", value: { projection: "missing" } });
  });

  it("reports the projection out of date when the root file differs and the package's file is current", async () => {
    expect(await runOverSlices({ root: PROJECTION_THAT_DIFFERS, web: PACKAGE_PROJECTION_PRESENT })).toMatchObject({ outcome: "ok", value: { projection: "out-of-date" } });
  });
});

const projectingRunner = () => {
  const realModules = createDefaultModuleLoaderPort({});
  const repositoryAt = vi.fn<ChecksRunnerPorts["repositoryAt"]>();
  const runnerOver = checksRunnerOver({
    ports: {
      repositoryAt,
      coreInstall: vi.fn<ChecksRunnerPorts["coreInstall"]>().mockReturnValue({ outcome: "ok", value: { form: "source" } }),
      modules: realModules,
      path,
      eslint,
    },
    platform: { fileText: createDefaultFileTextPort({}), fileRemoval: createDefaultFileRemovalPort({}), modules: realModules, path, eslint, moduleExtension: ".ts" },
  });
  return { runnerOver, repositoryAt };
};

describe("checksRunnerOver, giving the projection as project", () => {
  it("gives exactly the text a run compares against, for hone.eslint.mjs, and touches no repository", async () => {
    const { runnerOver, repositoryAt } = projectingRunner();
    expect({ outcome: await runnerOver.project(SELECTING_THE_CLASS_CHECK), touched: repositoryAt.mock.calls }).toEqual({
      outcome: { outcome: "ok", value: [{ file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT }] },
      touched: [],
    });
  });

  it("gives the answered files as off blocks, so records change the projection", async () => {
    const { runnerOver } = projectingRunner();
    const answered = [{ symptom: "authored-class-or-this", check: "class-keyword", file: repoPathSchema.parse("kept.ts") }];
    expect(await runnerOver.project({ ...SELECTING_THE_CLASS_CHECK, answered })).toEqual({
      outcome: "ok",
      value: [{ file: CHECKS_PROJECTION_PATH, text: checksProjectionText({ pluginImport: "../../api/eslint-plugin.ts", checks: [CLASS_PROJECTED], answered }) }],
    });
  });

  it("gives a file beside each package eslint.config.*, importing the plugin from its own folder", async () => {
    expect(await projectingRunner().runnerOver.project(WITH_A_PACKAGE_CONFIG)).toEqual({
      outcome: "ok",
      value: [
        { file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT },
        { file: PACKAGE_SLICE_PATH, text: PACKAGE_PROJECTION_TEXT },
      ],
    });
  });

  it("gives each package's file only the answers under that package, relative to it, and the root file all of them", async () => {
    const answered = [
      { symptom: "authored-class-or-this", check: "class-keyword", file: repoPathSchema.parse("kept.ts") },
      { symptom: "authored-class-or-this", check: "class-keyword", file: repoPathSchema.parse("packages/web/src/a.ts") },
    ];
    const rooted = [{ symptom: "authored-class-or-this", check: "class-keyword", file: repoPathSchema.parse("src/a.ts") }];
    expect(await projectingRunner().runnerOver.project({ ...WITH_A_PACKAGE_CONFIG, answered })).toEqual({
      outcome: "ok",
      value: [
        { file: CHECKS_PROJECTION_PATH, text: checksProjectionText({ pluginImport: "../../api/eslint-plugin.ts", checks: [CLASS_PROJECTED], answered }) },
        { file: PACKAGE_SLICE_PATH, text: checksProjectionText({ pluginImport: "../../../../api/eslint-plugin.ts", checks: [CLASS_PROJECTED], answered: rooted }) },
      ],
    });
  });

  it("gives only the root file for a package config under a repository-root lookup", async () => {
    expect(await projectingRunner().runnerOver.project({ ...WITH_A_PACKAGE_CONFIG, declaredConfigLookup: "repository-root" })).toEqual({
      outcome: "ok",
      value: [{ file: CHECKS_PROJECTION_PATH, text: CURRENT_PROJECTION_TEXT }],
    });
  });

  it("gives no files when no check runs on ESLint", async () => {
    expect(await projectingRunner().runnerOver.project(REQUEST)).toEqual({ outcome: "ok", value: [] });
  });

  it("is not ready for a repository that declares ESLint config roots", async () => {
    expect(await projectingRunner().runnerOver.project({ ...SELECTING_THE_CLASS_CHECK, declaredConfigRoots: [repoPathSchema.parse("packages/web")] })).toEqual(NOT_READY_DECLARED);
  });

  it("gives the text a run then reports as current, so the two read one source", async () => {
    const governance = lintingNothing();
    const projected = await projectingRunner().runnerOver.project(SELECTING_THE_CLASS_CHECK);
    assert(projected.outcome === "ok", "the projection is given");
    const [file] = projected.value;
    assert(file !== undefined, "one file is given");
    const outcome = await runnerOverProjection({ currents: rootOnly({ presence: "present", text: file.text }), ruleState: CONFIGURED_ON, governance }).run(SELECTING_THE_CLASS_CHECK);
    expect(outcome).toEqual({ outcome: "ok", value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current" } });
  });
});
