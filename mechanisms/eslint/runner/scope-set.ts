import type { NativeException } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import { type ResolvedConfig, type RuleState, ruleStateOf } from "./eslint-config-schema.ts";
import { type JsonComparison, sameJsonValue } from "./same-json-value.ts";

export type ScopeReason =
  | "ignored"
  | "rule-differs"
  | "parser-differs"
  | "language-differs"
  | "processor-differs"
  | "plugin-differs"
  | "directive-text"
  | "suppression-entry"
  | "command-line-option";

export type GovernedPluginRule = {
  readonly ruleId: string;
  readonly pluginNamespace: string;
  readonly loadedPlugin: unknown;
};

export type FileConfigs = {
  readonly file: RepoPath;
  readonly text: string;
  readonly team: ResolvedConfig;
  readonly governance: ResolvedConfig;
};

export type ScopedFile = { readonly file: RepoPath; readonly reasons: readonly ScopeReason[] };

export type ScopeSetPartition = { readonly scopeSet: readonly ScopedFile[]; readonly rest: readonly RepoPath[] };

type ResolvedTeamConfig = Exclude<ResolvedConfig, undefined>;

const INLINE_CONFIGURATION_COMMENT = /\/\/\s*eslint|\/\*\s*(?:eslint|global|exported)/;

const enforcedAlike = (request: { readonly team: RuleState; readonly governance: RuleState }): JsonComparison => {
  const { team, governance } = request;
  if (team.state !== "configured" || governance.state !== "configured" || team.severity !== governance.severity) {
    return "different";
  }
  return team.severity === 2 ? sameJsonValue({ left: team.options, right: governance.options }) : "different";
};

const ruleDiffers = (request: {
  readonly team: ResolvedTeamConfig;
  readonly governance: ResolvedConfig;
  readonly governedRules: readonly GovernedPluginRule[];
}): readonly ScopeReason[] =>
  request.governedRules.every(
    (governed) =>
      enforcedAlike({
        team: ruleStateOf({ resolved: request.team, ruleId: governed.ruleId }),
        governance: ruleStateOf({ resolved: request.governance, ruleId: governed.ruleId }),
      }) === "same",
  )
    ? []
    : ["rule-differs"];

const differsUnlessIdentical = (request: {
  readonly team: unknown;
  readonly governance: unknown;
  readonly reason: ScopeReason;
}): readonly ScopeReason[] => (request.team === request.governance ? [] : [request.reason]);

const parserDiffers = (request: {
  readonly team: ResolvedTeamConfig;
  readonly governance: ResolvedConfig;
}): readonly ScopeReason[] => {
  const governanceParser = request.governance?.languageOptions?.parser;
  return governanceParser === undefined
    ? ["parser-differs"]
    : differsUnlessIdentical({
        team: request.team.languageOptions?.parser,
        governance: governanceParser,
        reason: "parser-differs",
      });
};

const languageDiffers = (request: {
  readonly team: ResolvedTeamConfig;
  readonly governance: ResolvedConfig;
}): readonly ScopeReason[] =>
  request.governance === undefined
    ? ["language-differs"]
    : differsUnlessIdentical({
        team: request.team.language,
        governance: request.governance.language,
        reason: "language-differs",
      });

const processorDiffers = (request: {
  readonly team: ResolvedTeamConfig;
  readonly governance: ResolvedConfig;
}): readonly ScopeReason[] =>
  differsUnlessIdentical({
    team: request.team.processor,
    governance: request.governance?.processor,
    reason: "processor-differs",
  });

const pluginDiffers = (request: {
  readonly team: ResolvedTeamConfig;
  readonly governedRules: readonly GovernedPluginRule[];
}): readonly ScopeReason[] =>
  request.governedRules.every(
    (governed) =>
      governed.loadedPlugin !== undefined && request.team.plugins?.[governed.pluginNamespace] === governed.loadedPlugin,
  )
    ? []
    : ["plugin-differs"];

const configReasons = (request: {
  readonly configs: FileConfigs;
  readonly governedRules: readonly GovernedPluginRule[];
}): readonly ScopeReason[] => {
  const { team, governance } = request.configs;
  if (team === undefined) {
    return ["ignored"];
  }
  return [
    ...ruleDiffers({ team, governance, governedRules: request.governedRules }),
    ...parserDiffers({ team, governance }),
    ...languageDiffers({ team, governance }),
    ...processorDiffers({ team, governance }),
    ...pluginDiffers({ team, governedRules: request.governedRules }),
  ];
};

const textReasons = (request: { readonly text: string }): readonly ScopeReason[] =>
  INLINE_CONFIGURATION_COMMENT.test(request.text) ? ["directive-text"] : [];

const suppressedFiles = (request: { readonly nativeExceptions: readonly NativeException[] }): ReadonlySet<RepoPath> =>
  new Set(
    request.nativeExceptions.flatMap((exception) => (exception.kind === "suppression-entry" ? [exception.file] : [])),
  );

const suppressionReasons = (request: {
  readonly file: RepoPath;
  readonly suppressed: ReadonlySet<RepoPath>;
}): readonly ScopeReason[] => (request.suppressed.has(request.file) ? ["suppression-entry"] : []);

const packageFolderOf = (request: { readonly location: RepoPath }): string =>
  request.location.split("/").slice(0, -1).join("/");

const scriptedFolders = (request: { readonly nativeExceptions: readonly NativeException[] }): readonly string[] => [
  ...new Set(
    request.nativeExceptions.flatMap((exception) =>
      exception.kind === "command-line-option" ? [packageFolderOf({ location: exception.location })] : [],
    ),
  ),
];

const withinFolder = (request: { readonly file: RepoPath; readonly folder: string }): "within" | "outside" =>
  request.folder === "" || request.file.startsWith(`${request.folder}/`) ? "within" : "outside";

const commandLineReasons = (request: {
  readonly file: RepoPath;
  readonly folders: readonly string[];
}): readonly ScopeReason[] =>
  request.folders.some((folder) => withinFolder({ file: request.file, folder }) === "within")
    ? ["command-line-option"]
    : [];

const scopedFileOf = (request: {
  readonly configs: FileConfigs;
  readonly governedRules: readonly GovernedPluginRule[];
  readonly suppressed: ReadonlySet<RepoPath>;
  readonly folders: readonly string[];
}): ScopedFile => ({
  file: request.configs.file,
  reasons: [
    ...configReasons({ configs: request.configs, governedRules: request.governedRules }),
    ...textReasons({ text: request.configs.text }),
    ...suppressionReasons({ file: request.configs.file, suppressed: request.suppressed }),
    ...commandLineReasons({ file: request.configs.file, folders: request.folders }),
  ],
});

export const scopeSetPartition = (request: {
  readonly files: readonly FileConfigs[];
  readonly governedRules: readonly GovernedPluginRule[];
  readonly nativeExceptions: readonly NativeException[];
}): ScopeSetPartition => {
  const suppressed = suppressedFiles({ nativeExceptions: request.nativeExceptions });
  const folders = scriptedFolders({ nativeExceptions: request.nativeExceptions });
  const scoped = request.files.map((configs) =>
    scopedFileOf({ configs, governedRules: request.governedRules, suppressed, folders }),
  );
  return {
    scopeSet: scoped.filter((entry) => entry.reasons.length > 0),
    rest: scoped.filter((entry) => entry.reasons.length === 0).map((entry) => entry.file),
  };
};
