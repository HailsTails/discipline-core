import { z } from "zod";
import type { LoadFailure } from "../core/check/load-failure.ts";
import { runCheck } from "../core/check/run-check.ts";
import type { EmbeddedRunReport } from "../core/mechanism-port/embedded-run-report-schema.ts";
import type { EmbeddedRunner, EmbeddedRunRequest } from "../core/mechanism-port/embedded-runner-module-schema.ts";
import type { RunnerFailure } from "../core/mechanism-port/runner-failure.ts";
import type { RunnerClause } from "../core/mechanism-port/runner-module-schema.ts";
import { toolchainBoundEmbeddedRunner } from "../core/mechanism-port/toolchain-bound-runner.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort, type PathPort } from "../core/platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../core/values/absolute-path.ts";
import { DEFAULT_ASSESSMENT } from "../core/values/assessment.ts";
import type { RepoPath } from "../core/values/repo-path.ts";
import type { Result } from "../core/values/result.ts";
import type { CheckReport } from "../core/verdict/check-report.ts";
import { renderReportText } from "../core/verdict/report-text.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "../mechanisms/eslint/runner/create-eslint-runner.ts";
import { type ResolvedConfig, resolvedConfigSchema } from "../mechanisms/eslint/runner/eslint-config-schema.ts";
import {
  type CreateEslint,
  createEslintPort,
  type EslintSurface,
  type EslintSurfaceOptions,
  type EslintClass,
  type EslintToolchain,
  eslintOptionsOf,
  type LintedFile,
  lintedFileOf,
} from "../mechanisms/eslint/runner/eslint-instance.ts";
import { eslintPieceSettingsSchema } from "../mechanisms/eslint/runner/eslint-piece-settings-schema.ts";
import {
  type FileConfigs,
  type GovernedPluginRule,
  type ScopeSetPartition,
  scopeSetPartition,
} from "../mechanisms/eslint/runner/scope-set.ts";
import { type EslintLine, eslintClassOn, loadedEslintToolchain, modulesServingRunner } from "./eslint-toolchains.ts";
import { overlaidFileText } from "./overlaid-file-text.ts";

export type TeamParser = "as-configured" | "typescript-parser-block";

export type TeamSuppressions =
  | { readonly applied: "none" }
  | { readonly applied: "default-location" }
  | { readonly applied: "named-location"; readonly location: string };

type AppliedSuppressions = Exclude<TeamSuppressions, { readonly applied: "none" }>;

type EslintOptions = NonNullable<ConstructorParameters<EslintClass>[0]>;

export type ProofSubject = {
  readonly line: EslintLine;
  readonly teamParser: TeamParser;
  readonly teamSuppressions: TeamSuppressions;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly git: GitPort;
};

export type ProofPartition = ScopeSetPartition | "no-governance-lint";

export type ScopeSetProof = {
  readonly importedPiecesReport: string;
  readonly fullReport: string;
  readonly scopedReport: string;
  readonly partition: ProofPartition;
  readonly restGovernanceLint: readonly LintedFile[];
  readonly restTeamLint: readonly LintedFile[];
};

type SubjectRequest = {
  readonly line: EslintLine;
  readonly teamParser: TeamParser;
  readonly teamSuppressions?: TeamSuppressions;
  readonly git: GitPort;
};

type RecordedRun = {
  readonly request: EmbeddedRunRequest;
  readonly report: Result<EmbeddedRunReport, RunnerFailure>;
};

type GovernanceLint = (request: {
  readonly surface: EslintSurface;
  readonly filePaths: readonly string[];
}) => Promise<readonly LintedFile[]>;

type Recorded = {
  readonly teamOptions: readonly EslintSurfaceOptions[];
  readonly governanceOptions: readonly EslintSurfaceOptions[];
  readonly governanceLints: readonly (readonly LintedFile[])[];
  readonly runs: readonly RecordedRun[];
};

type Recorder = {
  readonly teamOptions: (options: EslintSurfaceOptions) => EslintSurfaceOptions;
  readonly governanceOptions: (options: EslintSurfaceOptions) => EslintSurfaceOptions;
  readonly governanceLint: (linted: readonly LintedFile[]) => readonly LintedFile[];
  readonly run: (run: RecordedRun) => RecordedRun["report"];
  readonly recorded: () => Recorded;
};

type RunSetUp = {
  readonly subject: ProofSubject;
  readonly toolchain: EslintToolchain;
  readonly pieceModules: ModuleLoaderPort;
  readonly governanceLint: GovernanceLint;
};

type RecordedSetUp = { readonly set: RunSetUp; readonly recorder: Recorder };

type RecordedToolchain = {
  readonly subject: ProofSubject;
  readonly toolchain: EslintToolchain;
  readonly recorded: Recorded;
};

const ESLINT_RUNNER_SUFFIX = "mechanisms/eslint/runner/runner.ts";

const GOVERNED_TYPESCRIPT_FILES: readonly string[] = ["**/*.{ts,tsx,mts,cts}"];

const FIXTURE_FOLDER: readonly string[] = ["mechanisms", "eslint", "runner", "test-fixtures"];

const DEFAULT_PATH = createDefaultPathPort({});

const INSTALL_ROOT = absolutePathSchema.parse(DEFAULT_PATH.join({ segments: [import.meta.dirname, ".."] }));

const loadedModuleSchema = z.object({ default: z.unknown() });

const NO_SUPPRESSIONS: TeamSuppressions = { applied: "none" };

const recorderOf = (): Recorder => {
  const teamOptions: EslintSurfaceOptions[] = [];
  const governanceOptions: EslintSurfaceOptions[] = [];
  const governanceLints: (readonly LintedFile[])[] = [];
  const runs: RecordedRun[] = [];
  return {
    teamOptions: (options) => {
      teamOptions.push(options);
      return options;
    },
    governanceOptions: (options) => {
      governanceOptions.push(options);
      return options;
    },
    governanceLint: (linted) => {
      governanceLints.push(linted);
      return linted;
    },
    run: (run) => {
      runs.push(run);
      return run.report;
    },
    recorded: () => ({ teamOptions, governanceOptions, governanceLints, runs }),
  };
};

const exactlyOne = <Entry>(request: { readonly entries: readonly Entry[]; readonly claim: string }): Entry => {
  const [entry, ...surplus] = request.entries;
  if (entry === undefined || surplus.length > 0) {
    throw new Error(`expected ${request.claim} exactly once, got ${request.entries.length}`);
  }
  return entry;
};

const atMostOne = <Entry>(request: {
  readonly entries: readonly Entry[];
  readonly claim: string;
}): Entry | undefined =>
  request.entries.length === 0 ? undefined : exactlyOne(request);

const teamOptionsOf = (request: {
  readonly options: EslintSurfaceOptions;
  readonly teamParser: TeamParser;
  readonly toolchain: EslintToolchain;
}): EslintSurfaceOptions =>
  request.teamParser === "as-configured"
    ? request.options
    : {
        ...request.options,
        overrideConfig: {
          files: GOVERNED_TYPESCRIPT_FILES,
          languageOptions: { parser: request.toolchain.typescriptParser },
          plugins: {},
          rules: {},
        },
      };

const everyFileLint: GovernanceLint = (request) => request.surface.lintFiles({ filePaths: request.filePaths });

const governanceSurface = (request: RecordedSetUp & { readonly options: EslintSurfaceOptions }): EslintSurface => {
  const surface = request.set.toolchain.createEslint({ options: request.recorder.governanceOptions(request.options) });
  return {
    ...surface,
    lintFiles: (lint) =>
      request.set.governanceLint({ surface, filePaths: lint.filePaths }).then(request.recorder.governanceLint),
  };
};

const recordingCreateEslint =
  (request: RecordedSetUp): CreateEslint =>
  (create) =>
    create.options.overrideConfig === undefined
      ? request.set.toolchain.createEslint({
          options: request.recorder.teamOptions(
            teamOptionsOf({
              options: create.options,
              teamParser: request.set.subject.teamParser,
              toolchain: request.set.toolchain,
            }),
          ),
        })
      : governanceSurface({ ...request, options: create.options });

const recordingRunner = (request: RecordedSetUp): EmbeddedRunner => {
  const runner = toolchainBoundEmbeddedRunner({
    toolchain: Promise.resolve({ outcome: "ok", value: request.set.toolchain }),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain: EslintToolchain) =>
      createEslintRunner({
        fileText: request.set.subject.fileText,
        modules: request.set.pieceModules,
        path: request.set.subject.path,
        eslint: createEslintPort({ toolchain: { ...toolchain, createEslint: recordingCreateEslint(request) } }),
        moduleExtension: ".ts",
      }),
  });
  return {
    ...runner,
    run: (run) => runner.run(run).then((report) => request.recorder.run({ request: run, report })),
  };
};

const reportTextOf = (request: { readonly report: Result<CheckReport, LoadFailure> }): string =>
  request.report.outcome === "ok"
    ? renderReportText({ report: request.report.value, output: "full" })
    : JSON.stringify(request.report.error);

const checkedText = (request: RecordedSetUp): Promise<string> =>
  runCheck({
    repoRoot: request.set.subject.repoRoot,
    installRoot: request.set.subject.installRoot,
    moduleExtension: ".ts",
    baseRevision: undefined,
    assessment: DEFAULT_ASSESSMENT,
    fileText: request.set.subject.fileText,
    modules: modulesServingRunner({
      runnerSuffix: ESLINT_RUNNER_SUFFIX,
      runner: recordingRunner(request),
      base: request.set.subject.modules,
    }),
    path: request.set.subject.path,
    git: request.set.subject.git,
  }).then((report) => reportTextOf({ report }));

const recordedCheck = async (request: { readonly set: RunSetUp }): Promise<{ readonly text: string; readonly recorded: Recorded }> => {
  const recorder = recorderOf();
  const text = await checkedText({ set: request.set, recorder });
  return { text, recorded: recorder.recorded() };
};

const onlyRun = (request: { readonly recorded: Recorded }): RecordedRun =>
  exactlyOne({ entries: request.recorded.runs, claim: "the ESLint runner's run" });

const teamSurface = (request: RecordedToolchain): EslintSurface =>
  request.toolchain.createEslint({
    options: exactlyOne({ entries: request.recorded.teamOptions, claim: "the query of the team's configuration" }),
  });

const pieceSettingsOf = (request: { readonly clause: RunnerClause }) =>
  eslintPieceSettingsSchema.parse(request.clause.settings);

const ruleIdOf = (request: { readonly clause: RunnerClause }): string => {
  const settings = pieceSettingsOf(request);
  return `${settings.pluginNamespace}/${settings.rule}`;
};

const pieceModulePathOf = (request: { readonly subject: ProofSubject; readonly clause: RunnerClause }): string =>
  request.subject.path.join({ segments: [request.clause.pieceRoot, pieceSettingsOf(request).pluginModule] });

const loadedPluginOf = async (request: {
  readonly subject: ProofSubject;
  readonly pieceModules: ModuleLoaderPort;
  readonly clause: RunnerClause;
}): Promise<unknown> => {
  const loaded = await request.pieceModules.load({ path: pieceModulePathOf(request) });
  if (loaded.outcome === "failed") {
    throw new Error(loaded.error.detail);
  }
  return loadedModuleSchema.parse(loaded.value).default;
};

const governedRuleOf = async (request: {
  readonly subject: ProofSubject;
  readonly pieceModules: ModuleLoaderPort;
  readonly clause: RunnerClause;
}): Promise<GovernedPluginRule> => ({
  ruleId: ruleIdOf(request),
  pluginNamespace: pieceSettingsOf(request).pluginNamespace,
  loadedPlugin: await loadedPluginOf(request),
});

const governedRulesOf = (request: {
  readonly subject: ProofSubject;
  readonly pieceModules: ModuleLoaderPort;
  readonly run: EmbeddedRunRequest;
}): Promise<readonly GovernedPluginRule[]> =>
  Promise.all(request.run.clauses.map((clause) => governedRuleOf({ ...request, clause })));

const resolvedFor = (request: { readonly surface: EslintSurface; readonly file: RepoPath }): Promise<ResolvedConfig> =>
  request.surface
    .calculateConfigForFile({ filePath: request.file })
    .then((resolved) => resolvedConfigSchema.parse(resolved));

const teamResolvedFor = (request: {
  readonly surface: EslintSurface;
  readonly file: RepoPath;
}): Promise<ResolvedConfig> =>
  request.surface
    .isPathIgnored({ filePath: request.file })
    .then((ignored) => (ignored ? undefined : resolvedFor(request)));

const fileTextOf = (request: { readonly subject: ProofSubject; readonly file: RepoPath }): string => {
  const text = request.subject.fileText.read({
    path: request.subject.path.join({ segments: [request.subject.repoRoot, request.file] }),
  });
  if (text.outcome === "failed") {
    throw new Error(text.error.detail);
  }
  return text.value;
};

const fileConfigsOf = (request: {
  readonly subject: ProofSubject;
  readonly team: EslintSurface;
  readonly governance: EslintSurface;
  readonly file: RepoPath;
}): Promise<FileConfigs> =>
  Promise.all([
    teamResolvedFor({ surface: request.team, file: request.file }),
    resolvedFor({ surface: request.governance, file: request.file }),
  ]).then(([team, governance]) => ({
    file: request.file,
    text: fileTextOf({ subject: request.subject, file: request.file }),
    team,
    governance,
  }));

const partitionOver = async (
  request: RecordedToolchain & {
    readonly pieceModules: ModuleLoaderPort;
    readonly governanceOptions: EslintSurfaceOptions;
    readonly run: EmbeddedRunRequest;
    readonly report: EmbeddedRunReport;
  },
): Promise<ScopeSetPartition> => {
  const team = teamSurface(request);
  const governance = request.toolchain.createEslint({ options: request.governanceOptions });
  return scopeSetPartition({
    files: await Promise.all(
      request.run.files.map((file) => fileConfigsOf({ subject: request.subject, team, governance, file })),
    ),
    governedRules: await governedRulesOf({ ...request, run: request.run }),
    nativeExceptions: request.report.nativeExceptions,
  });
};

const partitionOf = (
  request: RecordedToolchain & { readonly pieceModules: ModuleLoaderPort },
): Promise<ProofPartition> => {
  const run = onlyRun(request);
  const governanceOptions = atMostOne({
    entries: request.recorded.governanceOptions,
    claim: "the governance instance",
  });
  return governanceOptions === undefined || run.report.outcome === "failed"
    ? Promise.resolve("no-governance-lint")
    : partitionOver({ ...request, governanceOptions, run: run.request, report: run.report.value });
};

const repoPathOf = (request: { readonly subject: ProofSubject; readonly filePath: string }): string => {
  const location = request.subject.path.relative({ from: request.subject.repoRoot, to: request.filePath });
  if (location.relation === "different-root") {
    throw new Error(`${request.filePath} is outside the repository`);
  }
  return location.path;
};

const lintedIn = (request: {
  readonly subject: ProofSubject;
  readonly linted: readonly LintedFile[];
  readonly files: ReadonlySet<string>;
}): readonly LintedFile[] =>
  request.linted.filter((linted) =>
    request.files.has(repoPathOf({ subject: request.subject, filePath: linted.filePath })),
  );

const lintedOrNone = (request: {
  readonly surface: EslintSurface;
  readonly filePaths: readonly string[];
}): Promise<readonly LintedFile[]> =>
  request.filePaths.length === 0 ? Promise.resolve([]) : request.surface.lintFiles({ filePaths: request.filePaths });

const governedMessagesOf = (request: {
  readonly linted: LintedFile;
  readonly ruleIds: ReadonlySet<string>;
}): LintedFile => ({
  filePath: request.linted.filePath,
  messages: request.linted.messages.filter(
    (message) => message.fatal === true || (message.ruleId !== null && request.ruleIds.has(message.ruleId)),
  ),
});

const suppressionOptionsOf = (request: { readonly suppressions: AppliedSuppressions }): EslintOptions =>
  request.suppressions.applied === "named-location"
    ? { applySuppressions: true, suppressionsLocation: request.suppressions.location }
    : { applySuppressions: true };

const suppressingTeamLint = async (
  request: RecordedToolchain & { readonly suppressions: AppliedSuppressions; readonly filePaths: readonly string[] },
): Promise<readonly LintedFile[]> => {
  const eslintClass = await eslintClassOn({ line: request.subject.line });
  const options = exactlyOne({ entries: request.recorded.teamOptions, claim: "the query of the team's configuration" });
  const eslint = new eslintClass({
    ...eslintOptionsOf({ version: eslintClass.version, options }),
    ...suppressionOptionsOf(request),
  });
  return eslint.lintFiles([...request.filePaths]).then((results) => results.map(lintedFileOf));
};

const teamLint = (
  request: RecordedToolchain & { readonly filePaths: readonly string[] },
): Promise<readonly LintedFile[]> => {
  if (request.filePaths.length === 0) {
    return Promise.resolve([]);
  }
  const suppressions = request.subject.teamSuppressions;
  return suppressions.applied === "none"
    ? teamSurface(request).lintFiles({ filePaths: request.filePaths })
    : suppressingTeamLint({ ...request, suppressions });
};

const restEvidence = (
  request: RecordedToolchain & { readonly partition: ProofPartition },
): Promise<readonly LintedFile[]> => {
  if (request.partition === "no-governance-lint") {
    return Promise.resolve([]);
  }
  const ruleIds = new Set(onlyRun(request).request.clauses.map((clause) => ruleIdOf({ clause })));
  return teamLint({ ...request, filePaths: request.partition.rest }).then((linted) =>
    linted.map((file) => governedMessagesOf({ linted: file, ruleIds })),
  );
};

const orderedLike = (request: {
  readonly reference: readonly LintedFile[];
  readonly linted: readonly LintedFile[];
}): readonly LintedFile[] => {
  const order = new Map(request.reference.map((linted, index) => [linted.filePath, index]));
  const positionOf = (linted: LintedFile): number => order.get(linted.filePath) ?? request.reference.length;
  return [...request.linted].sort((left, right) => positionOf(left) - positionOf(right));
};

const scopedLint = (request: {
  readonly partition: ProofPartition;
  readonly evidence: readonly LintedFile[];
  readonly reference: readonly LintedFile[];
}): GovernanceLint => {
  if (request.partition === "no-governance-lint") {
    return everyFileLint;
  }
  const scopeFiles = new Set<string>(request.partition.scopeSet.map((scoped) => scoped.file));
  return (lint) =>
    lintedOrNone({
      surface: lint.surface,
      filePaths: lint.filePaths.filter((filePath) => scopeFiles.has(filePath)),
    }).then((scoped) => orderedLike({ reference: request.reference, linted: [...scoped, ...request.evidence] }));
};

const fullLintOf = (request: { readonly recorded: Recorded }): readonly LintedFile[] =>
  atMostOne({ entries: request.recorded.governanceLints, claim: "the governance lint" }) ?? [];

const restOf = (request: { readonly partition: ProofPartition }): ReadonlySet<string> =>
  new Set(request.partition === "no-governance-lint" ? [] : request.partition.rest);

const firstPluginOf = (request: {
  readonly configs: readonly ResolvedConfig[];
  readonly pluginNamespace: string;
}): unknown =>
  request.configs
    .map((config) => config?.plugins?.[request.pluginNamespace])
    .find((plugin) => plugin !== undefined);

const servedPiece = async (request: {
  readonly subject: ProofSubject;
  readonly team: EslintSurface;
  readonly files: readonly RepoPath[];
  readonly clause: RunnerClause;
}): Promise<readonly [string, unknown]> => {
  const configs = await Promise.all(request.files.map((file) => teamResolvedFor({ surface: request.team, file })));
  return [
    pieceModulePathOf(request),
    firstPluginOf({ configs, pluginNamespace: pieceSettingsOf(request).pluginNamespace }),
  ];
};

const servingModules = (request: {
  readonly served: ReadonlyMap<string, unknown>;
  readonly base: ModuleLoaderPort;
}): ModuleLoaderPort => ({
  load: (load) =>
    request.served.has(load.path)
      ? Promise.resolve({ outcome: "ok", value: { default: request.served.get(load.path) } })
      : request.base.load(load),
});

const teamPieceModules = async (request: RecordedToolchain): Promise<ModuleLoaderPort> => {
  if (request.recorded.teamOptions.length === 0) {
    return request.subject.modules;
  }
  const run = onlyRun(request).request;
  const team = teamSurface(request);
  const pieces = await Promise.all(
    run.clauses.map((clause) => servedPiece({ subject: request.subject, team, files: run.files, clause })),
  );
  return servingModules({
    served: new Map(pieces.filter(([, plugin]) => plugin !== undefined)),
    base: request.subject.modules,
  });
};

const subjectOn = (request: SubjectRequest & { readonly repoRoot: AbsolutePath; readonly fileText: FileTextPort }): ProofSubject => ({
  ...request,
  teamSuppressions: request.teamSuppressions ?? NO_SUPPRESSIONS,
  installRoot: INSTALL_ROOT,
  modules: createDefaultModuleLoaderPort({}),
  path: DEFAULT_PATH,
});

const fixtureRootOf = (request: { readonly fixture: string }): AbsolutePath =>
  absolutePathSchema.parse(DEFAULT_PATH.join({ segments: [INSTALL_ROOT, ...FIXTURE_FOLDER, request.fixture] }));

export const fixtureSubject = (request: SubjectRequest & { readonly fixture: string }): ProofSubject =>
  subjectOn({ ...request, repoRoot: fixtureRootOf(request), fileText: createDefaultFileTextPort({}) });

export const monorepoSubject = (
  request: SubjectRequest & { readonly fixture: string; readonly eslintVersion: string; readonly lintCommand: string },
): ProofSubject => {
  const repoRoot = fixtureRootOf(request);
  return subjectOn({
    ...request,
    repoRoot,
    fileText: overlaidFileText({
      base: createDefaultFileTextPort({}),
      files: {
        [DEFAULT_PATH.join({ segments: [repoRoot, "node_modules", "eslint", "package.json"] })]: JSON.stringify({
          name: "eslint",
          version: request.eslintVersion,
        }),
        [DEFAULT_PATH.join({ segments: [repoRoot, "package.json"] })]: JSON.stringify({
          scripts: { lint: request.lintCommand },
        }),
      },
    }),
  });
};

export const honeTreeSubject = (request: SubjectRequest): ProofSubject =>
  subjectOn({ ...request, repoRoot: INSTALL_ROOT, fileText: createDefaultFileTextPort({}) });

export const scopeSetProof = async (subject: ProofSubject): Promise<ScopeSetProof> => {
  const toolchain = await loadedEslintToolchain({ line: subject.line });
  const imported = await recordedCheck({
    set: { subject, toolchain, pieceModules: subject.modules, governanceLint: everyFileLint },
  });
  const pieceModules = await teamPieceModules({ subject, toolchain, recorded: imported.recorded });
  const full = await recordedCheck({ set: { subject, toolchain, pieceModules, governanceLint: everyFileLint } });
  const partition = await partitionOf({ subject, toolchain, recorded: full.recorded, pieceModules });
  const evidence = await restEvidence({ subject, toolchain, recorded: full.recorded, partition });
  const fullLint = fullLintOf({ recorded: full.recorded });
  const scoped = await recordedCheck({
    set: { subject, toolchain, pieceModules, governanceLint: scopedLint({ partition, evidence, reference: fullLint }) },
  });
  return {
    importedPiecesReport: imported.text,
    fullReport: full.text,
    scopedReport: scoped.text,
    partition,
    restGovernanceLint: lintedIn({ subject, linted: fullLint, files: restOf({ partition }) }),
    restTeamLint: evidence,
  };
};
