import type { NativeException } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import { type ResolvedConfig, type RuleState, ruleStateOf } from "./eslint-config-schema.ts";

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

export type JsonComparison = "same" | "different";

type JsonScalar = string | number | boolean | null;

type JsonShape =
  | { readonly shape: "scalar"; readonly scalar: JsonScalar }
  | { readonly shape: "list"; readonly items: readonly unknown[] }
  | { readonly shape: "record"; readonly entries: readonly (readonly [string, unknown])[] }
  | { readonly shape: "opaque" };

type ResolvedTeamConfig = Exclude<ResolvedConfig, undefined>;

const INLINE_CONFIGURATION_COMMENT = /\/\/\s*eslint|\/\*\s*(?:eslint|global|exported)/;

const scalarOf = (candidate: unknown): JsonScalar | undefined =>
  candidate === null || typeof candidate === "string" || typeof candidate === "number" || typeof candidate === "boolean"
    ? candidate
    : undefined;

const plainPrototype = (candidate: object): "plain" | "instance" => {
  const prototype: unknown = Object.getPrototypeOf(candidate);
  return prototype === Object.prototype || prototype === null ? "plain" : "instance";
};

const byKey = (left: readonly [string, unknown], right: readonly [string, unknown]): number =>
  left[0].localeCompare(right[0], "en");

const recordShapeOf = (candidate: object): JsonShape => {
  const entries: readonly (readonly [string, unknown])[] = Object.entries(candidate);
  return { shape: "record", entries: [...entries].sort(byKey) };
};

const objectShapeOf = (candidate: object): JsonShape => {
  if (Array.isArray(candidate)) {
    const items: readonly unknown[] = Array.from(candidate);
    return { shape: "list", items };
  }
  return plainPrototype(candidate) === "plain" ? recordShapeOf(candidate) : { shape: "opaque" };
};

const jsonShapeOf = (candidate: unknown): JsonShape => {
  const scalar = scalarOf(candidate);
  if (scalar !== undefined) {
    return { shape: "scalar", scalar };
  }
  return typeof candidate === "object" && candidate !== null ? objectShapeOf(candidate) : { shape: "opaque" };
};

const sameLists = (request: { readonly left: readonly unknown[]; readonly right: readonly unknown[] }): JsonComparison =>
  request.left.length === request.right.length &&
  request.left.every((element, index) => sameJsonValue({ left: element, right: request.right[index] }) === "same")
    ? "same"
    : "different";

const sameEntry = (request: {
  readonly left: readonly [string, unknown];
  readonly right: readonly [string, unknown] | undefined;
}): JsonComparison =>
  request.right !== undefined && request.left[0] === request.right[0]
    ? sameJsonValue({ left: request.left[1], right: request.right[1] })
    : "different";

const sameRecords = (request: {
  readonly left: readonly (readonly [string, unknown])[];
  readonly right: readonly (readonly [string, unknown])[];
}): JsonComparison =>
  request.left.length === request.right.length &&
  request.left.every((entry, index) => sameEntry({ left: entry, right: request.right[index] }) === "same")
    ? "same"
    : "different";

const sameShapes = (request: { readonly left: JsonShape; readonly right: JsonShape }): JsonComparison => {
  const { left, right } = request;
  if (left.shape === "scalar" && right.shape === "scalar") {
    return Object.is(left.scalar, right.scalar) ? "same" : "different";
  }
  if (left.shape === "list" && right.shape === "list") {
    return sameLists({ left: left.items, right: right.items });
  }
  if (left.shape === "record" && right.shape === "record") {
    return sameRecords({ left: left.entries, right: right.entries });
  }
  return "different";
};

export const sameJsonValue = (request: { readonly left: unknown; readonly right: unknown }): JsonComparison =>
  sameShapes({ left: jsonShapeOf(request.left), right: jsonShapeOf(request.right) });

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
