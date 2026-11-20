import { z } from "zod";
import type { ExceptionRecord } from "../../../core/exception-records/exception-records.ts";
import type { EmbeddedRunReport, ReturnedEmbeddedRunReport } from "../../../core/mechanism-port/embedded-run-report-schema.ts";
import type { EmbeddedRunner, EmbeddedRunRequest } from "../../../core/mechanism-port/embedded-runner-module-schema.ts";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { ProjectionRequest, RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type {
  CaseVerdict,
  Hit,
  MeasuredPair,
  NativeException,
  ProjectionWrite,
  ScriptOptionCause,
} from "../../../core/mechanism-port/runner-result-schema.ts";
import type { SourceCase } from "../../../core/rule-set-reader/rule-set-reader.ts";
import type { SliceProblem } from "../../../core/mechanism-port/embedded-run-report-schema.ts";
import type { FileRemovalPort } from "../../../core/platform-ports/file-removal-port.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoad, ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { sameClauseAddress } from "../../../core/values/clause-address.ts";
import type { ModuleExtension } from "../../../core/values/install-layout.ts";
import { gatheredOutcomes, listedOutcome } from "../../../core/values/gathered-outcomes.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import { TOOL_IDENTITY } from "../../../core/values/tool-identity.ts";
import { type CoreInstall, coreInstallOf } from "./core-install.ts";
import { type EslintRepository, eslintRepositoryOver } from "./eslint-repository.ts";
import type { RuleState } from "./eslint-config-schema.ts";
import {
  type ConfigFileSearch,
  type EslintPort,
  type GovernedRule,
  type IgnoredState,
  type LintedFile,
  type QueryInstance,
  reservedNamespace,
} from "./eslint-instance.ts";
import { type EslintPieceSettings, eslintPieceSettingsSchema, ruleOptionsOf } from "./eslint-piece-settings-schema.ts";
import { eslintPluginModuleSchema, type LoadedEslintPlugin } from "./eslint-plugin-schema.ts";
import { brokenConfigVerdict, cachedGoverningIgnores, type GoverningIgnores } from "./governing-config.ts";
import { namespaceOwnershipRefusal } from "./namespace-ownership.ts";
import { hitsCutFrom, messageReadingOf } from "./lint-hits.ts";
import { type LinesReader, sourceLinesFor } from "./source-lines.ts";
import type { ConfigLookup } from "./config-lookup.ts";
import {
  type PackageJsonScan,
  type PackageScriptsReader,
  type ScriptOption,
  scannedPackageScripts,
  type SelectedRule,
} from "./package-script-scanner.ts";
import { type OptionVerdict, type ScriptOptionJudge, scriptOptionJudge } from "./script-option-effect.ts";
import {
  type CurrentProjection,
  PROJECTION_PATH,
  type ProjectionFiles,
  pluginImportOf,
  projectionState,
} from "./projection.ts";
import { projectionHolding } from "./projection-holding.ts";
import { projectionStateAt } from "./projection-states.ts";
import {
  type ConfigRoot,
  configRootsOf,
  governingPackageOf,
  packageFoldersOf,
  nestedConfigurationFoldersOf,
  unprojectedFoldersOf,
  slicePathOf,
} from "./projection-slices.ts";
import {
  packageSliceProblemsOf,
  type ProjectionClause,
  type SliceOrigin,
  slicedProjectionWrites,
  sliceTextOf,
} from "./sliced-projection.ts";
import { type SuppressionsReader, suppressionEntriesIn } from "./suppressions-scanner.ts";

export type EslintPlatformPorts = {
  readonly fileText: FileTextPort;
  readonly fileRemoval: FileRemovalPort;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly eslint: EslintPort;
  readonly moduleExtension: ModuleExtension;
};

export type EslintRunnerPorts = {
  readonly repositoryAt: (request: { readonly repoRoot: AbsolutePath }) => EslintRepository;
  readonly coreInstall: (request: { readonly installRoot: AbsolutePath }) => Result<CoreInstall, RunnerFailure>;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly eslint: EslintPort;
};

type Outcome<Value> = Result<Value, RunnerFailure>;

type EslintRunReport = ReturnedEmbeddedRunReport & Required<Pick<EmbeddedRunReport, "measured">>;

type ConfiguredClause = {
  readonly clause: RunnerClause;
  readonly settings: EslintPieceSettings;
  readonly ruleId: string;
  readonly modulePath: string;
};

type LoadedClause<Clause extends ConfiguredClause> = Clause & { readonly plugin: LoadedEslintPlugin };

type SelectedClause = LoadedClause<ConfiguredClause>;

type CheckedFile = {
  readonly file: RepoPath;
  readonly states: readonly { readonly ruleId: string; readonly state: RuleState }[];
};

type QueriedFiles = {
  readonly ignored: readonly RepoPath[];
  readonly checked: readonly CheckedFile[];
};

type ProjectionEffect = "in-effect" | "not-in-effect";

type QueriedFile =
  | { readonly file: RepoPath; readonly ignored: "ignored" }
  | { readonly file: RepoPath; readonly ignored: "checked"; readonly states: CheckedFile["states"] };

type ProjectionStatus = { readonly projection: "current" | "out-of-date"; readonly slices: readonly SliceProblem[] };

type SliceSource = {
  readonly clauses: readonly ProjectionClause[];
  readonly records: readonly ExceptionRecord[];
  readonly origin: SliceOrigin;
};

type ParsedPlugin = Result<LoadedEslintPlugin, { readonly detail: string }>;

type SharedPlugin = { readonly configured: ConfiguredClause; readonly parsed: Promise<ParsedPlugin> };

const SUPPRESSIONS_FILE_NAME = "eslint-suppressions.json";

const PACKAGE_JSON_NAME = "package.json";

const pieceInvalid = (request: {
  readonly pieceRoot: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "piece-invalid", pieceRoot: request.pieceRoot, detail: request.detail },
});

const mappedOutcome = <Value, Mapped>(request: {
  readonly outcome: Outcome<Value>;
  readonly map: (okValue: Value) => Mapped;
}): Outcome<Mapped> =>
  request.outcome.outcome === "failed"
    ? request.outcome
    : { outcome: "ok", value: request.map(request.outcome.value) };

const configuredClause = (request: {
  readonly clause: RunnerClause;
  readonly path: PathPort;
}): Outcome<ConfiguredClause> => {
  const settings = eslintPieceSettingsSchema.safeParse(request.clause.settings);
  if (!settings.success) {
    return pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: z.prettifyError(settings.error) });
  }
  const refusal = namespaceOwnershipRefusal({
    address: request.clause.address,
    pluginNamespace: settings.data.pluginNamespace,
  });
  if (refusal !== undefined) {
    return pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: refusal });
  }
  if (settings.data.pluginNamespace === reservedNamespace) {
    return pieceInvalid({
      pieceRoot: request.clause.pieceRoot,
      detail: `the plugin namespace ${reservedNamespace} is reserved for ${TOOL_IDENTITY.command}'s own rules`,
    });
  }
  return {
    outcome: "ok",
    value: {
      clause: request.clause,
      settings: settings.data,
      ruleId: `${settings.data.pluginNamespace}/${settings.data.rule}`,
      modulePath: request.path.join({
        segments: [request.clause.pieceRoot, settings.data.pluginModule],
      }),
    },
  };
};

type ImportOrigin = { readonly repoRoot: AbsolutePath; readonly install: CoreInstall };

const importableClause = (request: {
  readonly configured: ConfiguredClause;
  readonly path: PathPort;
  readonly origin: ImportOrigin;
}): Outcome<ConfiguredClause> => {
  const pluginImport = pluginImportOf({
    path: request.path,
    importingDirectory: request.origin.repoRoot,
    install: request.origin.install,
    pieceRoot: request.configured.clause.pieceRoot,
    pluginModule: request.configured.settings.pluginModule,
  });
  if (pluginImport.placement === "piece-on-another-root") {
    return pieceInvalid({
      pieceRoot: request.configured.clause.pieceRoot,
      detail:
        "the piece is on a different root from the repository, so the committed projection cannot import it by a relative path",
    });
  }
  return { outcome: "ok", value: request.configured };
};

const importableConfiguredClause = (request: {
  readonly clause: RunnerClause;
  readonly path: PathPort;
  readonly origin: ImportOrigin;
}): Outcome<ConfiguredClause> => {
  const configured = configuredClause({ clause: request.clause, path: request.path });
  if (configured.outcome === "failed") {
    return configured;
  }
  return importableClause({ configured: configured.value, path: request.path, origin: request.origin });
};

const clashOf = (request: {
  readonly earlier: ConfiguredClause;
  readonly entry: ConfiguredClause;
}): "clashing" | "distinct" =>
  request.earlier.ruleId === request.entry.ruleId ||
  (request.earlier.settings.pluginNamespace === request.entry.settings.pluginNamespace &&
    request.earlier.modulePath !== request.entry.modulePath)
    ? "clashing"
    : "distinct";

const clashingClause = (request: {
  readonly configured: readonly ConfiguredClause[];
}): ConfiguredClause | undefined =>
  request.configured.find((entry, index) =>
    request.configured.slice(0, index).some((earlier) => clashOf({ earlier, entry }) === "clashing"),
  );

const configuredSelection = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly path: PathPort;
  readonly origin: ImportOrigin;
}): Outcome<readonly ConfiguredClause[]> => {
  const configured = gatheredOutcomes({
    outcomes: request.clauses.map((clause) =>
      listedOutcome({ outcome: importableConfiguredClause({ clause, path: request.path, origin: request.origin }) }),
    ),
  });
  if (configured.outcome === "failed") {
    return configured;
  }
  const clashing = clashingClause({ configured: configured.value });
  if (clashing !== undefined) {
    return pieceInvalid({
      pieceRoot: clashing.clause.pieceRoot,
      detail: `the rule ${clashing.ruleId} or its plugin namespace ${clashing.settings.pluginNamespace} is already selected from another piece`,
    });
  }
  return configured;
};

const parsedPluginOf = (request: { readonly loaded: ModuleLoad }): ParsedPlugin => {
  if (request.loaded.outcome === "failed") {
    return { outcome: "failed", error: { detail: request.loaded.error.detail } };
  }
  const parsed = eslintPluginModuleSchema.safeParse(request.loaded.value);
  if (!parsed.success) {
    return { outcome: "failed", error: { detail: z.prettifyError(parsed.error) } };
  }
  return { outcome: "ok", value: parsed.data.default };
};

const parsedPlugin = (request: {
  readonly modulePath: string;
  readonly modules: ModuleLoaderPort;
}): Promise<ParsedPlugin> =>
  request.modules.load({ path: request.modulePath }).then((loaded) => parsedPluginOf({ loaded }));

const pluginOf = <Clause extends ConfiguredClause>(request: {
  readonly parsed: ParsedPlugin;
  readonly configured: Clause;
}): Outcome<LoadedClause<Clause>> => {
  const pieceRoot = request.configured.clause.pieceRoot;
  if (request.parsed.outcome === "failed") {
    return pieceInvalid({ pieceRoot, detail: request.parsed.error.detail });
  }
  if (!Object.hasOwn(request.parsed.value.rules, request.configured.settings.rule)) {
    return pieceInvalid({
      pieceRoot,
      detail: `the plugin has no rule named ${request.configured.settings.rule}`,
    });
  }
  return { outcome: "ok", value: { ...request.configured, plugin: request.parsed.value } };
};

const loadedPlugin = (request: {
  readonly configured: ConfiguredClause;
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<LoadedClause<ConfiguredClause>>> =>
  parsedPlugin({ modulePath: request.configured.modulePath, modules: request.modules }).then((parsed) =>
    pluginOf({ parsed, configured: request.configured }),
  );

const distinctModules = (request: {
  readonly configured: readonly ConfiguredClause[];
  readonly modules: ModuleLoaderPort;
}): readonly { readonly modulePath: string; readonly parsed: Promise<ParsedPlugin> }[] =>
  [...new Set(request.configured.map((entry) => entry.modulePath))].map((modulePath) => ({
    modulePath,
    parsed: parsedPlugin({ modulePath, modules: request.modules }),
  }));

const sharedPluginsOf = (request: {
  readonly entry: ConfiguredClause;
  readonly loaded: readonly { readonly modulePath: string; readonly parsed: Promise<ParsedPlugin> }[];
}): readonly SharedPlugin[] =>
  request.loaded
    .filter((module) => module.modulePath === request.entry.modulePath)
    .map((module) => ({ configured: request.entry, parsed: module.parsed }));

const sharedPlugins = (request: {
  readonly configured: readonly ConfiguredClause[];
  readonly modules: ModuleLoaderPort;
}): readonly SharedPlugin[] => {
  const loaded = distinctModules(request);
  return request.configured.flatMap((entry) => sharedPluginsOf({ entry, loaded }));
};

const listedSelection = (request: { readonly shared: SharedPlugin }): Promise<Outcome<readonly SelectedClause[]>> =>
  request.shared.parsed.then((parsed) =>
    listedOutcome({ outcome: pluginOf({ parsed, configured: request.shared.configured }) }),
  );

const selectedClauses = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly path: PathPort;
  readonly origin: ImportOrigin;
  readonly modules: ModuleLoaderPort;
}): Promise<Outcome<readonly SelectedClause[]>> => {
  const configured = configuredSelection({ clauses: request.clauses, path: request.path, origin: request.origin });
  if (configured.outcome === "failed") {
    return Promise.resolve(configured);
  }
  return Promise.all(
    sharedPlugins({ configured: configured.value, modules: request.modules }).map((shared) =>
      listedSelection({ shared }),
    ),
  ).then((outcomes) => gatheredOutcomes({ outcomes }));
};

const projectionClausesOf = (request: {
  readonly configured: readonly ConfiguredClause[];
}): readonly ProjectionClause[] =>
  request.configured.map((entry) => ({
    address: entry.clause.address,
    ruleId: entry.ruleId,
    options: ruleOptionsOf({ settings: entry.settings }),
    pluginNamespace: entry.settings.pluginNamespace,
    pieceRoot: entry.clause.pieceRoot,
    pluginModule: entry.settings.pluginModule,
  }));

const sliceOriginOf = (request: { readonly path: PathPort; readonly origin: ImportOrigin }): SliceOrigin => ({
  path: request.path,
  repoRoot: request.origin.repoRoot,
  install: request.origin.install,
});

const unconfiguredSlicesOf = (request: {
  readonly folderConfiguration: EslintRepository["folderConfiguration"];
  readonly run: EmbeddedRunRequest;
  readonly roots: readonly ConfigRoot[];
}): readonly SliceProblem[] =>
  request.roots.flatMap((root) =>
    root.placement === "package" &&
    request.run.declaredConfigRoots.includes(root.directory) &&
    request.folderConfiguration({ folder: root.directory }) === "unconfigured"
      ? [{ slice: slicePathOf({ root }), state: "unconfigured" as const }]
      : [],
  );

const fileRuleStates = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly ruleId: string;
}): Promise<Outcome<CheckedFile["states"]>> =>
  request.query.ruleState({ file: request.file, ruleId: request.ruleId }).then((state) =>
    mappedOutcome({ outcome: state, map: (ruleState) => [{ ruleId: request.ruleId, state: ruleState }] }),
  );

const checkedQueriedFile = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly ruleIds: readonly string[];
}): Promise<Outcome<readonly QueriedFile[]>> =>
  Promise.all(
    request.ruleIds.map((ruleId) => fileRuleStates({ query: request.query, file: request.file, ruleId })),
  ).then((outcomes) =>
    mappedOutcome({
      outcome: gatheredOutcomes({ outcomes }),
      map: (states): readonly QueriedFile[] => [{ file: request.file, ignored: "checked", states }],
    }),
  );

const queriedFileOf = (request: {
  readonly ignoredState: Outcome<IgnoredState>;
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly ruleIds: readonly string[];
}): Promise<Outcome<readonly QueriedFile[]>> => {
  if (request.ignoredState.outcome === "failed") {
    return Promise.resolve(request.ignoredState);
  }
  if (request.ignoredState.value === "ignored") {
    return Promise.resolve({ outcome: "ok", value: [{ file: request.file, ignored: "ignored" }] });
  }
  return checkedQueriedFile({ query: request.query, file: request.file, ruleIds: request.ruleIds });
};

type ConfigLocation = {
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly governingIgnoreOf: GoverningIgnores;
};

const FULL_STOP = ".";

const sentenceOf = (request: { readonly text: string }): string =>
  request.text.endsWith(FULL_STOP) ? request.text : `${request.text}${FULL_STOP}`;

const configRepair = (request: { readonly configFile: string; readonly location: ConfigLocation }): string => {
  const folder = request.location.path.repositoryDirectoryOf({ path: request.configFile });
  return folder === "." || folder === ""
    ? "Fix that config."
    : `Fix that config. Only if ${folder} holds nothing Hone should check, add it to exclude in disciplines.json instead.`;
};

const foundConfigDetail = (request: {
  readonly file: RepoPath;
  readonly message: string;
  readonly configFile: string;
  readonly location: ConfigLocation;
}): string => {
  const placed = request.location.path.relative({ from: request.location.repoRoot, to: request.configFile });
  return placed.relation === "different-root"
    ? `${request.configFile}, the ESLint config for ${request.file}, failed to load: ${request.message} Fix that config.`
    : `${placed.path}, the ESLint config for ${request.file}, failed to load: ${request.message} ${configRepair({ configFile: placed.path, location: request.location })}`;
};

const unloadableConfigDetail = (request: {
  readonly file: RepoPath;
  readonly detail: string;
  readonly search: ConfigFileSearch;
  readonly location: ConfigLocation;
}): string => {
  const message = sentenceOf({ text: request.detail });
  switch (request.search.kind) {
    case "found":
      return foundConfigDetail({ file: request.file, message, configFile: request.search.path, location: request.location });
    case "none":
      return `no eslint.config.* applies to ${request.file}. Create one at the repository root that spreads disciplines.eslint.mjs last, as ADOPTING.md step 4a shows.`;
    case "unknown":
      return `the ESLint config for ${request.file} failed to load: ${message} Fix that config.`;
  }
};
const unloadableConfigFailure = (request: {
  readonly file: RepoPath;
  readonly detail: string;
  readonly search: ConfigFileSearch;
  readonly location: ConfigLocation;
}): Outcome<readonly QueriedFile[]> => ({
  outcome: "failed",
  error: { kind: "team-config-unloadable", detail: unloadableConfigDetail(request) },
});

const IGNORED_BY_GOVERNING_CONFIG = "ignored-by-governing-config";

const searchedQueryFailure = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly location: ConfigLocation;
  readonly detail: string;
  readonly search: ConfigFileSearch;
}): Promise<Outcome<readonly QueriedFile[]>> => {
  if (request.search.kind !== "found") {
    return Promise.resolve(unloadableConfigFailure(request));
  }
  return brokenConfigVerdict({
    lookup: {
      query: request.query,
      governingIgnoreOf: request.location.governingIgnoreOf,
      path: request.location.path,
      repoRoot: request.location.repoRoot,
    },
    brokenConfig: request.search.path,
    file: request.file,
  }).then((verdict): Outcome<readonly QueriedFile[]> =>
    verdict === IGNORED_BY_GOVERNING_CONFIG
      ? { outcome: "ok", value: [{ file: request.file, ignored: "ignored" }] }
      : unloadableConfigFailure(request),
  );
};

const explainedQueryFailure = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly location: ConfigLocation;
  readonly queried: Outcome<readonly QueriedFile[]>;
}): Promise<Outcome<readonly QueriedFile[]>> => {
  const queried = request.queried;
  if (queried.outcome === "ok" || queried.error.kind !== "team-config-unloadable") {
    return Promise.resolve(queried);
  }
  const detail = queried.error.detail;
  return request.query
    .configFileOf({ file: request.file })
    .then((search) => searchedQueryFailure({ query: request.query, file: request.file, location: request.location, detail, search }));
};

const queriedFile = (request: {
  readonly query: QueryInstance;
  readonly file: RepoPath;
  readonly ruleIds: readonly string[];
  readonly location: ConfigLocation;
}): Promise<Outcome<readonly QueriedFile[]>> =>
  request.query
    .ignoredState({ file: request.file })
    .then((ignoredState) => queriedFileOf({ ...request, ignoredState }))
    .then((queried) => explainedQueryFailure({ query: request.query, file: request.file, location: request.location, queried }));

const checkedFileOf = (request: { readonly entry: QueriedFile }): readonly CheckedFile[] =>
  request.entry.ignored === "checked" ? [{ file: request.entry.file, states: request.entry.states }] : [];

const partitionedFiles = (request: { readonly queried: readonly QueriedFile[] }): QueriedFiles => ({
  ignored: request.queried.filter((entry) => entry.ignored === "ignored").map((entry) => entry.file),
  checked: request.queried.flatMap((entry) => checkedFileOf({ entry })),
});

const queriedFiles = (request: {
  readonly query: QueryInstance;
  readonly files: readonly RepoPath[];
  readonly ruleIds: readonly string[];
  readonly location: ConfigLocation;
}): Promise<Outcome<QueriedFiles>> =>
  Promise.all(
    request.files.map((file) => queriedFile({ query: request.query, file, ruleIds: request.ruleIds, location: request.location })),
  ).then((outcomes) =>
    mappedOutcome({
      outcome: gatheredOutcomes({ outcomes }),
      map: (queried) => partitionedFiles({ queried }),
    }),
  );

const severityOf = (request: {
  readonly checked: CheckedFile;
  readonly ruleId: string;
}): RuleState | undefined =>
  request.checked.states.find((entry) => entry.ruleId === request.ruleId)?.state;

const offEffect = (request: { readonly state: RuleState | undefined }): ProjectionEffect =>
  request.state?.state === "configured" && request.state.severity === 0 ? "in-effect" : "not-in-effect";

const ruleIdsOfRecord = (request: {
  readonly record: ExceptionRecord;
  readonly selected: readonly SelectedClause[];
}): readonly string[] =>
  request.selected
    .filter(
      (entry) =>
        sameClauseAddress({ left: entry.clause.address, right: request.record.clause }) === "same",
    )
    .map((entry) => entry.ruleId);

const governedChecked = (request: {
  readonly record: ExceptionRecord;
  readonly checked: readonly CheckedFile[];
  readonly checkedByFile: ReadonlyMap<string, readonly CheckedFile[]>;
}): readonly CheckedFile[] => {
  const record = request.record;
  if (record.kind === "clause-wide-carve-out") {
    return request.checked;
  }
  return request.checkedByFile.get(record.file) ?? [];
};

const fileOffEffect = (request: {
  readonly checked: CheckedFile;
  readonly ruleIds: readonly string[];
}): ProjectionEffect =>
  request.ruleIds.every(
    (ruleId) => offEffect({ state: severityOf({ checked: request.checked, ruleId }) }) === "in-effect",
  )
    ? "in-effect"
    : "not-in-effect";

const recordEffect = (request: {
  readonly record: ExceptionRecord;
  readonly selected: readonly SelectedClause[];
  readonly checked: readonly CheckedFile[];
  readonly checkedByFile: ReadonlyMap<string, readonly CheckedFile[]>;
}): ProjectionEffect => {
  const ruleIds = ruleIdsOfRecord({ record: request.record, selected: request.selected });
  return governedChecked(request).every(
    (checked) => fileOffEffect({ checked, ruleIds }) === "in-effect",
  )
    ? "in-effect"
    : "not-in-effect";
};

const ruleEnablement = (request: {
  readonly ruleId: string;
  readonly checked: readonly CheckedFile[];
}): ProjectionEffect =>
  request.checked.length === 0 ||
  request.checked.some((checked) => severityOf({ checked, ruleId: request.ruleId })?.state === "configured")
    ? "in-effect"
    : "not-in-effect";

const enabledEffect = (request: {
  readonly selected: readonly SelectedClause[];
  readonly checked: readonly CheckedFile[];
}): ProjectionEffect =>
  request.selected.every(
    (entry) => ruleEnablement({ ruleId: entry.ruleId, checked: request.checked }) === "in-effect",
  )
    ? "in-effect"
    : "not-in-effect";

const exemptingEffect = (request: {
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly checked: readonly CheckedFile[];
}): ProjectionEffect => {
  const checkedByFile = Map.groupBy(request.checked, (checked): string => checked.file);
  return request.records.every(
    (record) => recordEffect({ record, selected: request.selected, checked: request.checked, checkedByFile }) === "in-effect",
  )
    ? "in-effect"
    : "not-in-effect";
};

const projectionEffect = (request: {
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly queried: QueriedFiles;
}): ProjectionEffect => {
  const enabled = enabledEffect({ selected: request.selected, checked: request.queried.checked });
  const exempting = exemptingEffect({
    selected: request.selected,
    records: request.records,
    checked: request.queried.checked,
  });
  return enabled === "in-effect" && exempting === "in-effect" ? "in-effect" : "not-in-effect";
};

const ruleEnforcement = (request: {
  readonly checked: CheckedFile;
  readonly ruleId: string;
}): "enforced" | "weakened" => {
  const state = severityOf({ checked: request.checked, ruleId: request.ruleId });
  return state?.state === "configured" && state.severity === 2 ? "enforced" : "weakened";
};

const ignoreExceptions = (request: {
  readonly selected: readonly SelectedClause[];
  readonly file: RepoPath;
}): readonly NativeException[] =>
  request.selected.map((entry): NativeException => ({ kind: "ignore", clause: entry.clause.address, file: request.file }));

const overrideExceptions = (request: {
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly checked: CheckedFile;
}): readonly NativeException[] =>
  request.selected
    .filter((entry) => ruleEnforcement({ checked: request.checked, ruleId: entry.ruleId }) === "weakened")
    .filter((entry) => projectionHolding({ records: request.records, clause: entry.clause.address, file: request.checked.file }) === "not-held")
    .map(
      (entry): NativeException => ({
        kind: "config-override",
        clause: entry.clause.address,
        file: request.checked.file,
      }),
    );

const queryExceptions = (request: {
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly queried: QueriedFiles;
}): readonly NativeException[] => [
  ...request.queried.ignored.flatMap((file) => ignoreExceptions({ selected: request.selected, file })),
  ...request.queried.checked.flatMap((checked) =>
    overrideExceptions({ selected: request.selected, records: request.records, checked }),
  ),
];

const outsideRepository = (request: { readonly linted: LintedFile }): Outcome<RepoPath> => ({
  outcome: "failed",
  error: {
    kind: "tool-failed",
    detail: `ESLint linted ${request.linted.filePath}, which is outside the repository`,
  },
});

const lintedRepoPath = (request: {
  readonly linted: LintedFile;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): Outcome<RepoPath> => {
  const location = request.path.relative({ from: request.repoRoot, to: request.linted.filePath });
  if (location.relation === "different-root") {
    return outsideRepository(request);
  }
  const file = repoPathSchema.safeParse(location.path);
  return file.success ? { outcome: "ok", value: file.data } : outsideRepository(request);
};

const parseableFile = (request: {
  readonly linted: LintedFile;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): Outcome<RepoPath> => {
  const file = lintedRepoPath(request);
  if (file.outcome === "failed") {
    return file;
  }
  const fatal = request.linted.messages.find((message) => message.fatal === true);
  if (fatal !== undefined) {
    return {
      outcome: "failed",
      error: { kind: "file-unparseable", file: file.value, detail: fatal.message },
    };
  }
  return file;
};

type LintFindings = {
  readonly hits: readonly Hit[];
  readonly nativeExceptions: readonly NativeException[];
  readonly measured: readonly MeasuredPair[];
};

const ruleCoverageOf = (request: { readonly linted: LintedFile }): "every-rule-ran" | "rule-less-message" =>
  request.linted.messages.some((message) => message.ruleId === null) ? "rule-less-message" : "every-rule-ran";

const measuredOn = (request: {
  readonly file: RepoPath;
  readonly linted: LintedFile;
  readonly selected: readonly SelectedClause[];
}): readonly MeasuredPair[] =>
  ruleCoverageOf({ linted: request.linted }) === "rule-less-message"
    ? []
    : request.selected.map((entry) => ({ clause: entry.clause.address, file: request.file }));

const lintedFindings = (request: {
  readonly linted: LintedFile;
  readonly selected: readonly SelectedClause[];
  readonly path: PathPort;
  readonly sourceLines: LinesReader;
  readonly repoRoot: AbsolutePath;
}): Outcome<LintFindings> => {
  const file = parseableFile({ linted: request.linted, path: request.path, repoRoot: request.repoRoot });
  if (file.outcome === "failed") {
    return file;
  }
  const reading = messageReadingOf({ file: file.value, messages: request.linted.messages, selected: request.selected });
  if (reading.outcome === "failed") {
    return reading;
  }
  const lines = sourceLinesFor({
    file: file.value,
    ruleHits: reading.value.ruleHits,
    readLines: request.sourceLines,
  });
  return mappedOutcome({
    outcome: lines,
    map: (sourceLines): LintFindings => ({
      hits: hitsCutFrom({ file: file.value, ruleHits: reading.value.ruleHits, lines: sourceLines }),
      nativeExceptions: reading.value.nativeExceptions,
      measured: measuredOn({ file: file.value, linted: request.linted, selected: request.selected }),
    }),
  });
};

const directoryOf = (request: { readonly path: RepoPath }): RepoPath | "repo-root" => {
  const directory = repoPathSchema.safeParse(request.path.split("/").slice(0, -1).join("/"));
  return directory.success ? directory.data : "repo-root";
};

const fileNameOf = (request: { readonly path: RepoPath }): string | undefined =>
  request.path.split("/").at(-1);

const filesNamed = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly name: string;
}): readonly RepoPath[] => request.trackedPaths.filter((path) => fileNameOf({ path }) === request.name);

const suppressionsExceptions = (request: {
  readonly suppressionsAt: SuppressionsReader;
  readonly location: RepoPath;
  readonly keysRelativeTo: RepoPath | "repo-root";
  readonly selectedRules: readonly SelectedRule[];
}): Outcome<readonly NativeException[]> => {
  const suppressions = request.suppressionsAt({ location: request.location });
  return suppressions.outcome === "failed"
    ? suppressions
    : suppressionEntriesIn({
        location: request.location,
        keysRelativeTo: request.keysRelativeTo,
        suppressions: suppressions.value,
        selectedRules: request.selectedRules,
      });
};

const causeOf = (request: { readonly verdict: OptionVerdict; readonly option: ScriptOption }): ScriptOptionCause | undefined => {
  switch (request.verdict.kind) {
    case "weakens":
      return { kind: "weakens-run" };
    case "not-plain":
      return { ...request.verdict.reason, command: request.option.command };
    case "weakens-nothing":
      return undefined;
  }
};

const weakeningExceptions = (request: {
  readonly option: ScriptOption;
  readonly judge: ScriptOptionJudge;
}): Promise<Outcome<readonly NativeException[]>> =>
  request.judge({ option: request.option }).then((verdict) => {
    if (verdict.outcome === "failed") {
      return verdict;
    }
    const cause = causeOf({ verdict: verdict.value, option: request.option });
    return {
      outcome: "ok",
      value: cause === undefined ? [] : request.option.exceptions.map((exception): NativeException => ({ ...exception, cause })),
    };
  });

const judgedScriptExceptions = (request: {
  readonly scan: PackageJsonScan;
  readonly judge: ScriptOptionJudge;
}): Promise<Outcome<readonly NativeException[]>> =>
  Promise.all(request.scan.scriptOptions.map((option) => weakeningExceptions({ option, judge: request.judge }))).then(
    (outcomes) => gatheredOutcomes({ outcomes }),
  );

const unreadableScriptExceptions = (request: { readonly scan: PackageJsonScan }): readonly NativeException[] =>
  request.scan.unreadableScripts.flatMap((unreadable) =>
    unreadable.exceptions.map((exception): NativeException => ({ ...exception, cause: { kind: "unreadable", command: unreadable.command } })),
  );

const scannedPackageExceptions = (request: {
  readonly suppressionsAt: SuppressionsReader;
  readonly packagePath: RepoPath;
  readonly scan: PackageJsonScan;
  readonly selectedRules: readonly SelectedRule[];
  readonly judge: ScriptOptionJudge;
}): Promise<Outcome<readonly NativeException[]>> =>
  judgedScriptExceptions(request).then((scriptExceptions) =>
    gatheredOutcomes({
      outcomes: [
        scriptExceptions,
        { outcome: "ok", value: unreadableScriptExceptions({ scan: request.scan }) },
        ...request.scan.suppressionsLocations.map((scripted) =>
        suppressionsExceptions({
          suppressionsAt: request.suppressionsAt,
          location: scripted.location,
            keysRelativeTo: directoryOf({ path: request.packagePath }),
            selectedRules: request.selectedRules,
          }),
        ),
      ],
    }),
  );

const packageJsonExceptions = (request: {
  readonly packageScriptsAt: PackageScriptsReader;
  readonly suppressionsAt: SuppressionsReader;
  readonly packagePath: RepoPath;
  readonly selectedRules: readonly SelectedRule[];
  readonly judge: ScriptOptionJudge;
}): Promise<Outcome<readonly NativeException[]>> => {
  const scripts = request.packageScriptsAt({ packagePath: request.packagePath });
  if (scripts.outcome === "failed") {
    return Promise.resolve(scripts);
  }
  const scan = scannedPackageScripts({
    path: request.packagePath,
    scripts: scripts.value,
    selectedRules: request.selectedRules,
  });
  if (scan.outcome === "failed") {
    return Promise.resolve(scan);
  }
  return scannedPackageExceptions({ ...request, scan: scan.value });
};

const trackedExceptions = (request: {
  readonly packageScriptsAt: PackageScriptsReader;
  readonly suppressionsAt: SuppressionsReader;
  readonly trackedPaths: readonly RepoPath[];
  readonly selectedRules: readonly SelectedRule[];
  readonly judge: ScriptOptionJudge;
}): Promise<Outcome<readonly NativeException[]>> =>
  Promise.all([
    ...filesNamed({ trackedPaths: request.trackedPaths, name: SUPPRESSIONS_FILE_NAME }).map((location) =>
      Promise.resolve(suppressionsExceptions({ ...request, location, keysRelativeTo: directoryOf({ path: location }) })),
    ),
    ...filesNamed({ trackedPaths: request.trackedPaths, name: PACKAGE_JSON_NAME }).map((packagePath) =>
      packageJsonExceptions({ ...request, packagePath }),
    ),
  ]).then((outcomes) => gatheredOutcomes({ outcomes }));

const reportWith = (request: {
  readonly projection: ReturnedEmbeddedRunReport["projection"];
  readonly slices: readonly SliceProblem[];
}): Outcome<EslintRunReport> => ({
  outcome: "ok",
  value: { hits: [], nativeExceptions: [], projection: request.projection, slices: request.slices, measured: [] },
});

const ruleIdsOf = (request: { readonly selected: readonly SelectedClause[] }): readonly string[] =>
  request.selected.map((entry) => entry.ruleId);

const governedRulesOf = (request: { readonly selected: readonly SelectedClause[] }): readonly GovernedRule[] =>
  request.selected.map((entry) => ({ ruleId: entry.ruleId, options: ruleOptionsOf({ settings: entry.settings }) }));

const pluginsByNamespace = (request: {
  readonly selected: readonly SelectedClause[];
}): Readonly<Record<string, LoadedEslintPlugin>> =>
  Object.fromEntries(request.selected.map((entry) => [entry.settings.pluginNamespace, entry.plugin]));

const selectedRulesOf = (request: { readonly selected: readonly SelectedClause[] }): readonly SelectedRule[] =>
  request.selected.map((entry) => ({ ruleId: entry.ruleId, clause: entry.clause.address }));

const recordsUnderCheck = (request: {
  readonly records: readonly ExceptionRecord[];
  readonly checked: readonly CheckedFile[];
}): readonly ExceptionRecord[] => {
  const checkedFiles = new Set<string>(request.checked.map((checked) => checked.file));
  return request.records.filter((record) => record.kind === "clause-wide-carve-out" || checkedFiles.has(record.file));
};

const fileRecordsOf = (request: {
  readonly records: readonly ExceptionRecord[];
}): readonly Exclude<ExceptionRecord, { readonly kind: "clause-wide-carve-out" }>[] =>
  request.records.flatMap((record) => (record.kind === "clause-wide-carve-out" ? [] : [record]));

const governedLint = (request: {
  readonly run: EmbeddedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly eslint: EslintPort;
}): Promise<Outcome<readonly LintedFile[]>> => {
  if (request.run.files.length === 0 || request.selected.length === 0) {
    return Promise.resolve({ outcome: "ok", value: [] });
  }
  return request.eslint
    .createGovernanceInstance({
      repoRoot: request.run.repoRoot,
      plugins: pluginsByNamespace({ selected: request.selected }),
      rules: governedRulesOf({ selected: request.selected }),
    })
    .lintFiles({ files: request.run.files });
};

const governedReport = (request: {
  readonly run: EmbeddedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly status: ProjectionStatus;
  readonly ports: EslintRunnerPorts;
  readonly repository: EslintRepository;
  readonly query: QueryInstance;
  readonly queried: QueriedFiles;
  readonly lintedFiles: readonly LintedFile[];
}): Promise<Outcome<EslintRunReport>> => {
  const findings = gatheredOutcomes({
    outcomes: request.lintedFiles.map((linted) =>
      listedOutcome({
        outcome: lintedFindings({
          linted,
          selected: request.selected,
          path: request.ports.path,
          sourceLines: request.repository.sourceLines,
          repoRoot: request.run.repoRoot,
        }),
      }),
    ),
  });
  if (findings.outcome === "failed") {
    return Promise.resolve(findings);
  }
  return trackedExceptions({
    packageScriptsAt: request.repository.packageScriptsAt,
    suppressionsAt: request.repository.suppressionsAt,
    trackedPaths: request.run.trackedPaths,
    selectedRules: selectedRulesOf({ selected: request.selected }),
    judge: scriptOptionJudge({
      query: request.query,
      eslint: request.ports.eslint,
      path: request.ports.path,
      repoRoot: request.run.repoRoot,
      checked: request.queried.checked.map((checked) => checked.file),
    }),
  }).then((tracked) => {
    if (tracked.outcome === "failed") {
      return tracked;
    }
    return {
      outcome: "ok",
      value: {
        hits: findings.value.flatMap((found) => found.hits),
        nativeExceptions: [
          ...queryExceptions({ selected: request.selected, records: request.run.records, queried: request.queried }),
          ...findings.value.flatMap((found) => found.nativeExceptions),
          ...tracked.value,
        ],
        projection: request.status.projection,
        slices: request.status.slices,
        measured: findings.value.flatMap((found) => found.measured),
      },
    };
  });
};

const lintedReport = (request: {
  readonly run: EmbeddedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly status: ProjectionStatus;
  readonly ports: EslintRunnerPorts;
  readonly repository: EslintRepository;
  readonly query: QueryInstance;
  readonly queried: QueriedFiles;
}): Promise<Outcome<EslintRunReport>> =>
  governedLint({ run: request.run, selected: request.selected, eslint: request.ports.eslint }).then(
    (lintedFiles) =>
      lintedFiles.outcome === "failed" ? lintedFiles : governedReport({ ...request, lintedFiles: lintedFiles.value }),
  );

const unappliedSliceOf = (request: {
  readonly folder: RepoPath;
  readonly state: "not-applied" | "nested-configuration";
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly checked: readonly CheckedFile[];
}): readonly SliceProblem[] =>
  projectionEffect({
    selected: request.selected,
    records: recordsUnderCheck({ records: request.records, checked: request.checked }),
    queried: { ignored: [], checked: request.checked },
  }) === "not-in-effect"
    ? [{ slice: slicePathOf({ root: { placement: "package", directory: request.folder } }), state: request.state }]
    : [];

const unappliedSlicesOf = (request: {
  readonly roots: readonly ConfigRoot[];
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly queried: QueriedFiles;
}): readonly SliceProblem[] => {
  const packages = packageFoldersOf({ roots: request.roots });
  const checkedByPackage = Map.groupBy(request.queried.checked, (entry) => governingPackageOf({ file: entry.file, packages }));
  const fileRecordsByPackage = Map.groupBy(fileRecordsOf({ records: request.records }), (record) =>
    governingPackageOf({ file: record.file, packages }),
  );
  const clauseWide = request.records.filter((record) => record.kind === "clause-wide-carve-out");
  return request.roots.flatMap((root) =>
    root.placement === "repository"
      ? []
      : unappliedSliceOf({
          folder: root.directory,
          state: "not-applied",
          selected: request.selected,
          records: [...clauseWide, ...(fileRecordsByPackage.get(root.directory) ?? [])],
          checked: checkedByPackage.get(root.directory) ?? [],
        }),
  );
};

const nestedConfigurationSlicesOf = (request: {
  readonly folders: readonly RepoPath[];
  readonly selected: readonly SelectedClause[];
  readonly records: readonly ExceptionRecord[];
  readonly queried: QueriedFiles;
}): readonly SliceProblem[] => {
  const clauseWide = request.records.filter((record) => record.kind === "clause-wide-carve-out");
  return request.folders.flatMap((folder) => {
    const prefix = `${folder}/`;
    return unappliedSliceOf({
      folder,
      state: "nested-configuration",
      selected: request.selected,
      records: [...clauseWide, ...fileRecordsOf({ records: request.records }).filter((record) => record.file.startsWith(prefix))],
      checked: request.queried.checked.filter((entry) => entry.file.startsWith(prefix)),
    });
  });
};

const queriedReport = (request: {
  readonly run: EmbeddedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly status: ProjectionStatus;
  readonly attributedRoots: readonly ConfigRoot[];
  readonly nestedFolders: readonly RepoPath[];
  readonly ports: EslintRunnerPorts;
  readonly repository: EslintRepository;
  readonly query: QueryInstance;
  readonly queried: Outcome<QueriedFiles>;
}): Promise<Outcome<EslintRunReport>> => {
  if (request.queried.outcome === "failed") {
    return Promise.resolve(request.queried);
  }
  const queried = request.queried.value;
  const records = recordsUnderCheck({ records: request.run.records, checked: queried.checked });
  if (projectionEffect({ selected: request.selected, records, queried }) === "not-in-effect") {
    const unapplied = unappliedSlicesOf({
      roots: request.attributedRoots,
      selected: request.selected,
      records: request.run.records,
      queried,
    });
    const nested = nestedConfigurationSlicesOf({
      folders: request.nestedFolders,
      selected: request.selected,
      records: request.run.records,
      queried,
    });
    return Promise.resolve(reportWith({ projection: "not-included", slices: [...request.status.slices, ...unapplied, ...nested] }));
  }
  return lintedReport({ ...request, queried });
};

const governedRun = (request: {
  readonly run: EmbeddedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly status: ProjectionStatus;
  readonly roots: readonly ConfigRoot[];
  readonly lookup: ConfigLookup;
  readonly ports: EslintRunnerPorts;
  readonly repository: EslintRepository;
}): Promise<Outcome<EslintRunReport>> => {
  const lookup = request.lookup;
  const query = request.ports.eslint.createQueryInstance(
    lookup.kind === "repository-root"
      ? { repoRoot: request.run.repoRoot, configFile: lookup.configFile }
      : { repoRoot: request.run.repoRoot },
  );
  return queriedFiles({
    query,
    files: request.run.files,
    ruleIds: ruleIdsOf({ selected: request.selected }),
    location: {
      path: request.ports.path,
      repoRoot: request.run.repoRoot,
      governingIgnoreOf: cachedGoverningIgnores({ eslint: request.ports.eslint }),
    },
  }).then((queried) =>
    queriedReport({
      ...request,
      attributedRoots: lookup.kind === "repository-root" ? [] : request.roots,
      nestedFolders:
        lookup.kind === "repository-root"
          ? []
          : nestedConfigurationFoldersOf({ trackedPaths: request.run.trackedPaths, files: request.run.files }),
      query,
      queried,
    }),
  );
};

const projectionStatusOf = (request: {
  readonly current: CurrentProjection;
  readonly source: SliceSource;
  readonly roots: readonly ConfigRoot[];
  readonly projectionFiles: ProjectionFiles;
}): Outcome<ProjectionStatus> => {
  const generated = sliceTextOf({ ...request.source, root: { placement: "repository" } });
  if (generated.outcome === "failed") {
    return generated;
  }
  const slices = packageSliceProblemsOf({ ...request.source, projectionFiles: request.projectionFiles, roots: request.roots });
  if (slices.outcome === "failed") {
    return slices;
  }
  const state = projectionState({ current: request.current, generated: generated.value });
  return { outcome: "ok", value: { projection: state === "current" ? "current" : "out-of-date", slices: slices.value } };
};

const selectedRun = (request: {
  readonly run: EmbeddedRunRequest;
  readonly selected: readonly SelectedClause[];
  readonly origin: ImportOrigin;
  readonly ports: EslintRunnerPorts;
}): Promise<Outcome<EslintRunReport>> => {
  const repository = request.ports.repositoryAt({ repoRoot: request.run.repoRoot });
  const states = repository.projectionFiles.currentOf({ files: [PROJECTION_PATH] });
  if (states.outcome === "failed") {
    return Promise.resolve(states);
  }
  const current = projectionStateAt({ states: states.value, file: PROJECTION_PATH });
  if (current.outcome === "failed") {
    return Promise.resolve(current);
  }
  if (current.value.presence === "absent") {
    return Promise.resolve(reportWith({ projection: "missing", slices: [] }));
  }
  const lookup = repository.teamConfigLookup({ trackedPaths: request.run.trackedPaths });
  if (lookup.outcome === "failed") {
    return Promise.resolve(lookup);
  }
  const roots = configRootsOf({
    trackedPaths: request.run.trackedPaths,
    declared: request.run.declaredConfigRoots,
    lookup: lookup.value.kind,
  });
  const status = projectionStatusOf({
    current: current.value,
    source: {
      clauses: projectionClausesOf({ configured: request.selected }),
      records: request.run.records,
      origin: sliceOriginOf({ path: request.ports.path, origin: request.origin }),
    },
    roots,
    projectionFiles: repository.projectionFiles,
  });
  if (status.outcome === "failed") {
    return Promise.resolve(status);
  }
  const unprojectedFolders = unprojectedFoldersOf({
    trackedPaths: request.run.trackedPaths,
    files: request.run.files,
    lookup: lookup.value.kind,
  });
  return governedRun({
    ...request,
    repository,
    status: {
      ...status.value,
      slices: [...status.value.slices, ...unconfiguredSlicesOf({ folderConfiguration: repository.folderConfiguration, run: request.run, roots })],
    },
    roots,
    lookup: lookup.value,
  }).then((report) => (report.outcome === "failed" ? report : { outcome: "ok", value: { ...report.value, unprojectedFolders } }));
};

const lintedSourceCases = (request: {
  readonly selected: Outcome<LoadedClause<ConfiguredClause>>;
  readonly cwd: AbsolutePath;
  readonly cases: readonly SourceCase[];
  readonly eslint: EslintPort;
}): Promise<Outcome<readonly CaseVerdict[]>> => {
  if (request.selected.outcome === "failed") {
    return Promise.resolve(request.selected);
  }
  return request.eslint.lintSourceCases({
    cwd: request.cwd,
    plugin: request.selected.value.plugin,
    pluginNamespace: request.selected.value.settings.pluginNamespace,
    rule: request.selected.value.settings.rule,
    options: ruleOptionsOf({ settings: request.selected.value.settings }),
    cases: request.cases,
  });
};

const conformedCases = (request: {
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
  readonly ports: EslintRunnerPorts;
}): Promise<Outcome<readonly CaseVerdict[]>> => {
  const configured = configuredClause({ clause: request.clause, path: request.ports.path });
  if (configured.outcome === "failed") {
    return Promise.resolve(configured);
  }
  const cwd = absolutePathSchema.safeParse(request.clause.pieceRoot);
  if (!cwd.success) {
    return Promise.resolve(pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: z.prettifyError(cwd.error) }));
  }
  return loadedPlugin({ configured: configured.value, modules: request.ports.modules }).then((selected) =>
    lintedSourceCases({ selected, cwd: cwd.data, cases: request.cases, eslint: request.ports.eslint }),
  );
};

const importOriginOf = (request: {
  readonly ports: EslintRunnerPorts;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
}): Outcome<ImportOrigin> => {
  const install = request.ports.coreInstall({ installRoot: request.installRoot });
  return install.outcome === "failed" ? install : { outcome: "ok", value: { repoRoot: request.repoRoot, install: install.value } };
};

const projectedWrite = (request: {
  readonly request: ProjectionRequest;
  readonly ports: EslintRunnerPorts;
}): Promise<Outcome<readonly ProjectionWrite[]>> => {
  const origin = importOriginOf({
    ports: request.ports,
    repoRoot: request.request.repoRoot,
    installRoot: request.request.installRoot,
  });
  if (origin.outcome === "failed") {
    return Promise.resolve(origin);
  }
  const configured = configuredSelection({
    clauses: request.request.clauses,
    path: request.ports.path,
    origin: origin.value,
  });
  if (configured.outcome === "failed") {
    return Promise.resolve(configured);
  }
  const repository = request.ports.repositoryAt({ repoRoot: request.request.repoRoot });
  const source = {
    projectionFiles: repository.projectionFiles,
    clauses: projectionClausesOf({ configured: configured.value }),
    records: request.request.records,
    origin: sliceOriginOf({ path: request.ports.path, origin: origin.value }),
  };
  return Promise.resolve(
    slicedProjectionWrites({
      ...source,
      roots: configRootsOf({
        trackedPaths: request.request.trackedPaths,
        declared: request.request.declaredConfigRoots,
        lookup: repository.configLookup({ trackedPaths: request.request.trackedPaths }),
      }),
      trackedPaths: request.request.trackedPaths,
    }),
  );
};

const ranClauses = (request: {
  readonly run: EmbeddedRunRequest;
  readonly ports: EslintRunnerPorts;
}): ReturnType<EmbeddedRunner["run"]> => {
  const origin = importOriginOf({ ports: request.ports, repoRoot: request.run.repoRoot, installRoot: request.run.installRoot });
  if (origin.outcome === "failed") {
    return Promise.resolve(origin);
  }
  return selectedClauses({
    clauses: request.run.clauses,
    path: request.ports.path,
    origin: origin.value,
    modules: request.ports.modules,
  }).then((selected) =>
    selected.outcome === "failed"
      ? selected
      : selectedRun({ run: request.run, selected: selected.value, origin: origin.value, ports: request.ports }),
  );
};

export const ESLINT_PROJECTED_KINDS: readonly NativeException["kind"][] = ["config-override", "inline-disable"];

export const eslintRunnerOver = (ports: EslintRunnerPorts): EmbeddedRunner => ({
  exceptionPath: "embedded",
  projectedKinds: ESLINT_PROJECTED_KINDS,
  run: (request) => ranClauses({ run: request, ports }),
  conform: (request) => conformedCases({ clause: request.clause, cases: request.cases, ports }),
  project: (request) => projectedWrite({ request, ports }),
});

export const createEslintRunner = (platform: EslintPlatformPorts): EmbeddedRunner =>
  eslintRunnerOver({
    repositoryAt: ({ repoRoot }) => eslintRepositoryOver({ ...platform, repoRoot }),
    coreInstall: ({ installRoot }) => coreInstallOf({ ...platform, installRoot }),
    modules: platform.modules,
    path: platform.path,
    eslint: platform.eslint,
  });
