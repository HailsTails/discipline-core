import { z } from "zod";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { StandaloneRunner } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { ProjectedFile } from "../../../core/mechanism-port/checks-runner-types.ts";
import { gatheredOutcomes, listedOutcome } from "../../../core/values/gathered-outcomes.ts";
import type { Result } from "../../../core/values/result.ts";
import type { ChecksRunnerPorts, EslintPlatformPorts } from "./checks-ports.ts";
import { checksRepositoryOver } from "./checks-repository.ts";
import type { ChecksPlugin } from "./checks-plugin.ts";
import type { ChecksRunFailure, ChecksRunReport, ChecksRunRequest, ChecksProjectionState, NotReadyCause, SelectedCheck } from "./checks-run-types.ts";
import { lintedFindingsOf } from "./checks-lint-findings.ts";
import { CHECKS_PROJECTION_PATH, checksProjectionText, type ProjectedCheck } from "./checks-projection.ts";
import { queriedFilesOf, projectionEffectOf, queryExceptionsOf, type QueriedFiles } from "./checks-queried-files.ts";
import { nestedVersionTwoRepositoriesOf, SETTINGS_FILE_NAME } from "./checks-nested-repositories.ts";
import { selectedChecksOf } from "./checks-selection.ts";
import { trackedExceptionsOf } from "./checks-tracked-exceptions.ts";
import { CHECKS_PLUGIN_NAMESPACE, eslintRuleIdsOf } from "./check-rule-id.ts";
import { cachedGoverningIgnores } from "./governing-config.ts";
import { coreInstallOf } from "./core-install.ts";
import { MISNAMED_DISABLE_RULE, MISNAMED_DISABLE_RULE_ID, misnamedDisableRule } from "./misnamed-disable-rule.ts";
import { eslintPieceSettingsSchema } from "./eslint-piece-settings-schema.ts";
import { eslintPluginModuleSchema, type LoadedEslintPlugin } from "./eslint-plugin-schema.ts";
import { configLookupDeclaring, teamConfigLookupFor } from "./config-lookup.ts";
import type { QueryInstance } from "./eslint-instance.ts";
import { packageConfigFilesOf } from "./checks-config-roots.ts";
import type { EslintConfigLookup } from "../../../core/values/eslint-config-lookup.ts";
import { conformedCases, loadedPieceClauseOf } from "./eslint-conform.ts";
import { honePluginAt, honePluginFailureText } from "./hone-plugin.ts";
import { checksPluginImportOf, type ProjectionFailure, projectedChecksOf } from "./projected-checks.ts";
import { projectionState } from "./projection.ts";
import { projectionStateAt } from "./projection-states.ts";
import { scriptOptionJudge } from "./script-option-effect.ts";

type Outcome<Value> = Result<Value, ChecksRunFailure>;

export type ChecksRunner = {
  readonly run: (request: ChecksRunRequest) => Promise<Outcome<ChecksRunReport>>;
  readonly conform: StandaloneRunner["conform"];
  readonly project: (request: ChecksRunRequest) => Promise<Outcome<readonly ProjectedFile[]>>;
};

const NO_FINDINGS = { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [] };

const reportAs = (request: { readonly projection: ChecksProjectionState }): Outcome<ChecksRunReport> => ({
  outcome: "ok",
  value: { ...NO_FINDINGS, projection: request.projection },
});

const toolFailed = (request: { readonly detail: string }): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "tool-failed", detail: request.detail },
});

const projectionFailureOf = (request: { readonly failure: ProjectionFailure }): RunnerFailure => {
  const { failure } = request;
  switch (failure.kind) {
    case "piece-invalid":
      return failure;
    case "check-unknown":
      return { kind: "tool-failed", detail: `${failure.address} names no check that runs on ESLint` };
    case "check-outside-rule-set":
      return { kind: "tool-failed", detail: `${failure.address} is not a check of this tool's own rule set` };
  }
};

const versionOneRuleIdsOf = (request: { readonly bindings: ChecksRunRequest["bindings"] }): readonly string[] =>
  request.bindings.flatMap((binding) => {
    const settings = eslintPieceSettingsSchema.safeParse(binding.clause.settings);
    return settings.success ? [`${settings.data.pluginNamespace}/${settings.data.rule}`] : [];
  });

const lookupRequestOf = (request: { readonly run: ChecksRunRequest; readonly platform: EslintPlatformPorts }) => ({
  fileText: request.platform.fileText,
  path: request.platform.path,
  repoRoot: request.run.repoRoot,
  trackedPaths: request.run.trackedPaths,
});

const lookupOf = (request: { readonly run: ChecksRunRequest; readonly platform: EslintPlatformPorts }): EslintConfigLookup =>
  configLookupDeclaring({ ...lookupRequestOf(request), declared: request.run.declaredConfigLookup });

const notReadyFor = (request: { readonly cause: NotReadyCause; readonly paths: readonly string[] }): Outcome<never> => ({
  outcome: "failed",
  error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", cause: request.cause, paths: request.paths } },
});

const notReadyOver = (request: { readonly run: ChecksRunRequest; readonly platform: EslintPlatformPorts }): Outcome<never> | undefined => {
  const { run } = request;
  if (run.declaredConfigRoots.length > 0) {
    return notReadyFor({ cause: "declared-roots", paths: run.declaredConfigRoots });
  }
  const packages = packageConfigFilesOf({ trackedPaths: run.trackedPaths, lookup: lookupOf(request) });
  if (packages.length > 0) {
    return notReadyFor({ cause: "package-configs", paths: packages });
  }
  const nested = nestedVersionTwoRepositoriesOf({ trackedPaths: run.trackedPaths, files: run.files });
  return nested.length > 0 ? notReadyFor({ cause: "nested-repositories", paths: nested }) : undefined;
};

const queryInstanceOf = (request: { readonly run: ChecksRunRequest; readonly platform: EslintPlatformPorts; readonly ports: ChecksRunnerPorts }): Result<QueryInstance, RunnerFailure> => {
  const lookup = teamConfigLookupFor({ ...lookupRequestOf(request), lookup: lookupOf(request), settingsFile: SETTINGS_FILE_NAME });
  if (lookup.outcome === "failed") {
    return lookup;
  }
  return {
    outcome: "ok",
    value: request.ports.eslint.createQueryInstance(
      lookup.value.kind === "repository-root" ? { repoRoot: request.run.repoRoot, configFile: lookup.value.configFile } : { repoRoot: request.run.repoRoot },
    ),
  };
};

const loadedPlugin = (request: { readonly plugin: ChecksPlugin; readonly checkRuleIds: readonly string[] }): Result<LoadedEslintPlugin, RunnerFailure> => {
  const loaded = eslintPluginModuleSchema.safeParse({
    default: { ...request.plugin, rules: { ...request.plugin.rules, [MISNAMED_DISABLE_RULE]: misnamedDisableRule({ checkRuleIds: request.checkRuleIds }) } },
  });
  return loaded.success ? { outcome: "ok", value: loaded.data.default } : toolFailed({ detail: `the Hone plugin is not an ESLint plugin: ${z.prettifyError(loaded.error)}` });
};

const builtPlugin = async (request: { readonly run: ChecksRunRequest; readonly checkRuleIds: readonly string[]; readonly ports: ChecksRunnerPorts; readonly platform: EslintPlatformPorts }): Promise<Result<LoadedEslintPlugin, RunnerFailure>> => {
  const plugin = await honePluginAt({
    checks: request.run.checks,
    installRoot: request.run.installRoot,
    fileText: request.platform.fileText,
    path: request.platform.path,
    modules: request.platform.modules,
  });
  return plugin.outcome === "failed" ? toolFailed({ detail: honePluginFailureText({ failure: plugin.error }) }) : loadedPlugin({ plugin: plugin.value, checkRuleIds: request.checkRuleIds });
};

const expectedProjectionOf = (request: { readonly run: ChecksRunRequest; readonly projected: readonly ProjectedCheck[]; readonly ports: ChecksRunnerPorts }): Result<string, RunnerFailure> => {
  const install = request.ports.coreInstall({ installRoot: request.run.installRoot });
  if (install.outcome === "failed") {
    return install;
  }
  const pluginImport = checksPluginImportOf({ path: request.ports.path, importingDirectory: request.run.repoRoot, installRoot: request.run.installRoot, install: install.value });
  return pluginImport.placement === "importable"
    ? { outcome: "ok", value: checksProjectionText({ pluginImport: pluginImport.specifier, checks: request.projected, answered: request.run.answered }) }
    : toolFailed({ detail: `the Hone plugin cannot be imported from ${request.run.repoRoot}` });
};

const currentProjectionState = (request: {
  readonly run: ChecksRunRequest;
  readonly projected: readonly ProjectedCheck[];
  readonly ports: ChecksRunnerPorts;
}): Result<"missing" | "current" | "out-of-date", RunnerFailure> => {
  const repository = request.ports.repositoryAt({ repoRoot: request.run.repoRoot });
  const states = repository.projectionFiles.currentOf({ files: [CHECKS_PROJECTION_PATH] });
  if (states.outcome === "failed") {
    return states;
  }
  const current = projectionStateAt({ states: states.value, file: CHECKS_PROJECTION_PATH });
  if (current.outcome === "failed") {
    return current;
  }
  const expected = expectedProjectionOf(request);
  return expected.outcome === "failed" ? expected : { outcome: "ok", value: projectionState({ current: current.value, generated: expected.value }) };
};

type LintRequest = {
  readonly run: ChecksRunRequest;
  readonly selected: readonly SelectedCheck[];
  readonly plugin: LoadedEslintPlugin;
  readonly queried: QueriedFiles;
  readonly query: QueryInstance;
  readonly ports: ChecksRunnerPorts;
  readonly versionOneRuleIds: readonly string[];
};

const lintedReport = async (request: LintRequest & { readonly projection: ChecksProjectionState }): Promise<Outcome<ChecksRunReport>> => {
  const { run, ports } = request;
  const repository = ports.repositoryAt({ repoRoot: run.repoRoot });
  const linted = await ports.eslint
    .createGovernanceInstance({
      repoRoot: run.repoRoot,
      plugins: { [CHECKS_PLUGIN_NAMESPACE]: request.plugin },
      rules: [...request.selected.map((entry) => ({ ruleId: entry.ruleId, options: entry.options })), { ruleId: MISNAMED_DISABLE_RULE_ID, options: [] }],
    })
    .lintFiles({ files: run.files });
  if (linted.outcome === "failed") {
    return linted;
  }
  const findings = gatheredOutcomes({
    outcomes: linted.value.map((file) =>
      listedOutcome({ outcome: lintedFindingsOf({ linted: file, path: ports.path, repoRoot: run.repoRoot, sourceLines: repository.sourceLines, selected: request.selected, checkRuleIds: eslintRuleIdsOf({ checks: run.checks }), versionOneRuleIds: request.versionOneRuleIds }) }),
    ),
  });
  if (findings.outcome === "failed") {
    return findings;
  }
  const tracked = await trackedExceptionsOf({
    packageScriptsAt: repository.packageScriptsAt,
    suppressionsAt: repository.suppressionsAt,
    trackedPaths: run.trackedPaths,
    selected: request.selected,
    judge: scriptOptionJudge({ query: request.query, eslint: ports.eslint, path: ports.path, repoRoot: run.repoRoot, checked: request.queried.checked.map((checked) => checked.file) }),
  });
  return tracked.outcome === "failed"
    ? tracked
    : {
        outcome: "ok",
        value: {
          hits: findings.value.flatMap((found) => found.hits),
          nativeExceptions: [...queryExceptionsOf({ selected: request.selected, answered: run.answered, queried: request.queried }), ...findings.value.flatMap((found) => found.nativeExceptions), ...tracked.value],
          measured: findings.value.flatMap((found) => found.measured),
          projection: request.projection,
          misnamedRuleIds: findings.value.flatMap((found) => found.misnamedRuleIds),
        },
      };
};

const queriedRun = async (request: Omit<LintRequest, "queried" | "query"> & { readonly platform: EslintPlatformPorts; readonly projection: ChecksProjectionState }): Promise<Outcome<ChecksRunReport>> => {
  const query = queryInstanceOf(request);
  if (query.outcome === "failed") {
    return query;
  }
  const queried = await queriedFilesOf({
    query: query.value,
    files: request.run.files,
    ruleIds: request.selected.map((entry) => entry.ruleId),
    location: { path: request.ports.path, repoRoot: request.run.repoRoot, governingIgnoreOf: cachedGoverningIgnores({ eslint: request.ports.eslint }) },
  });
  if (queried.outcome === "failed") {
    return queried;
  }
  return projectionEffectOf({ selected: request.selected, answered: request.run.answered, queried: queried.value }) === "not-in-effect"
    ? reportAs({ projection: "not-included" })
    : lintedReport({ ...request, query: query.value, queried: queried.value });
};

const projectedRun = async (request: { readonly run: ChecksRunRequest; readonly ports: ChecksRunnerPorts; readonly platform: EslintPlatformPorts }): Promise<Outcome<ChecksRunReport>> => {
  const projected = projectedChecksOf({ checks: request.run.checks, bindings: request.run.bindings });
  if (projected.outcome === "failed") {
    return { outcome: "failed", error: projectionFailureOf({ failure: projected.error }) };
  }
  const selected = selectedChecksOf({ checks: request.run.checks, projected: projected.value });
  if (selected.outcome === "failed" || selected.value.length === 0) {
    return selected.outcome === "failed" ? selected : reportAs({ projection: "current" });
  }
  const state = currentProjectionState({ ...request, projected: projected.value });
  if (state.outcome === "failed" || state.value === "missing") {
    return state.outcome === "failed" ? state : reportAs({ projection: "missing" });
  }
  const plugin = await builtPlugin({ ...request, checkRuleIds: eslintRuleIdsOf({ checks: request.run.checks }) });
  return plugin.outcome === "failed"
    ? plugin
    : queriedRun({ run: request.run, platform: request.platform, selected: selected.value, plugin: plugin.value, ports: request.ports, versionOneRuleIds: versionOneRuleIdsOf(request.run), projection: state.value });
};

const projectedFilesOf = (request: { readonly run: ChecksRunRequest; readonly ports: ChecksRunnerPorts }): Outcome<readonly ProjectedFile[]> => {
  const projected = projectedChecksOf({ checks: request.run.checks, bindings: request.run.bindings });
  if (projected.outcome === "failed") {
    return { outcome: "failed", error: projectionFailureOf({ failure: projected.error }) };
  }
  const selected = selectedChecksOf({ checks: request.run.checks, projected: projected.value });
  if (selected.outcome === "failed" || selected.value.length === 0) {
    return selected.outcome === "failed" ? selected : { outcome: "ok", value: [] };
  }
  const expected = expectedProjectionOf({ ...request, projected: projected.value });
  if (expected.outcome === "failed") {
    return expected;
  }
  return { outcome: "ok", value: [{ file: CHECKS_PROJECTION_PATH, text: expected.value }] };
};

export const checksRunnerOver = (request: { readonly ports: ChecksRunnerPorts; readonly platform: EslintPlatformPorts }): ChecksRunner => ({
  run: (run) => Promise.resolve(notReadyOver({ run, platform: request.platform })).then((notReady) => notReady ?? projectedRun({ run, ports: request.ports, platform: request.platform })),
  project: (run) => Promise.resolve(notReadyOver({ run, platform: request.platform }) ?? projectedFilesOf({ run, ports: request.ports })),
  conform: (conform) =>
    conformedCases({
      clause: conform.clause,
      cases: conform.cases,
      path: request.ports.path,
      eslint: request.ports.eslint,
      loadedPlugin: ({ configured }) => loadedPieceClauseOf({ configured, modules: request.ports.modules }),
    }),
});

export const createChecksRunner = (platform: EslintPlatformPorts): ChecksRunner =>
  checksRunnerOver({
    platform,
    ports: {
      repositoryAt: ({ repoRoot }) => checksRepositoryOver({ ...platform, repoRoot }),
      coreInstall: ({ installRoot }) => coreInstallOf({ ...platform, installRoot }),
      modules: platform.modules,
      path: platform.path,
      eslint: platform.eslint,
    },
  });
