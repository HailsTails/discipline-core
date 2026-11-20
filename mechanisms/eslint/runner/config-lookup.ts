import type { EslintConfigLookup } from "../../../core/values/eslint-config-lookup.ts";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import { parsedJson } from "../../../core/rule-set-reader/rule-set-reader.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import { packageJsonSchema } from "./eslint-file-schemas.ts";
import type { EslintMajorBoundary } from "./eslint-major-boundary.ts";
import { eslintInvocationsOf, scriptCommandsOf } from "./package-script-scanner.ts";

export type ConfigLookup =
  | { readonly kind: "nearest-to-file" }
  | { readonly kind: "repository-root"; readonly configFile: string };

const PACKAGE_JSON_NAME = "package.json";

const FLAG_OPTION = "--flag";

const FLAG_OPTION_JOINED = `${FLAG_OPTION}=`;

export const CONFIG_FILE_NAMES: readonly string[] = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
];

const NEAREST: ConfigLookup = { kind: "nearest-to-file" };

type LookupRequest = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
  readonly boundary: EslintMajorBoundary;
};

const flagsNamedBy = (request: { readonly options: readonly string[] }): readonly string[] =>
  request.options.flatMap((option, index) => {
    if (option.startsWith(FLAG_OPTION_JOINED)) {
      return [option.slice(FLAG_OPTION_JOINED.length)];
    }
    const next = request.options[index + 1];
    return option === FLAG_OPTION && next !== undefined ? [next] : [];
  });

const scriptsOf = (request: LookupRequest & { readonly packagePath: RepoPath }): readonly string[] => {
  const text = request.fileText.read({ path: request.path.join({ segments: [request.repoRoot, request.packagePath] }) });
  const json = text.outcome === "ok" ? parsedJson({ text: text.value }) : undefined;
  const parsed = json?.outcome === "ok" ? packageJsonSchema.safeParse(json.value) : undefined;
  return parsed?.success ? Object.values(parsed.data.scripts ?? {}) : [];
};

const lintScriptFlags = (request: LookupRequest): readonly string[] =>
  request.trackedPaths
    .filter((path) => path.split("/").at(-1) === PACKAGE_JSON_NAME)
    .flatMap((packagePath) => scriptsOf({ ...request, packagePath }))
    .flatMap((script) => {
      const commands = scriptCommandsOf({ script });
      return commands.outcome === "ok" ? eslintInvocationsOf({ commands: commands.value }) : [];
    })
    .flatMap((invocation) => flagsNamedBy({ options: invocation.options }));

const rootConfigFile = (request: Pick<LookupRequest, "fileText" | "path" | "repoRoot">): string | undefined =>
  CONFIG_FILE_NAMES.map((name) => request.path.join({ segments: [request.repoRoot, name] })).find(
    (candidate) => request.fileText.exists({ path: candidate }) === "present",
  );

export type FolderConfiguration = "configured" | "unconfigured";

export const folderConfigurationOf = (
  request: Pick<LookupRequest, "fileText" | "path" | "repoRoot"> & { readonly folder: RepoPath },
): FolderConfiguration =>
  CONFIG_FILE_NAMES.some(
    (name) => request.fileText.exists({ path: request.path.join({ segments: [request.repoRoot, request.folder, name] }) }) === "present",
  )
    ? "configured"
    : "unconfigured";

const detectedLookup = (request: LookupRequest): EslintConfigLookup =>
  request.boundary.lookupSelectedBy({ flags: lintScriptFlags(request) });

export const configLookupDeclaring = (request: LookupRequest & { readonly declared: EslintConfigLookup | undefined }): EslintConfigLookup =>
  request.declared ?? detectedLookup(request);

export const teamConfigLookupFor = (
  request: Pick<LookupRequest, "fileText" | "path" | "repoRoot"> & { readonly lookup: EslintConfigLookup; readonly settingsFile: string },
): Result<ConfigLookup, RunnerFailure> => {
  if (request.lookup === "nearest-to-file") {
    return { outcome: "ok", value: NEAREST };
  }
  const configFile = rootConfigFile(request);
  return configFile === undefined
    ? {
        outcome: "failed",
        error: {
          kind: "team-config-unloadable",
          detail: `the repository root has no eslint.config.* for a root-only config lookup; add one there, or set eslintConfigLookup to nearest-to-file in ${request.settingsFile} if ESLint runs from each package`,
        },
      }
    : { outcome: "ok", value: { kind: "repository-root", configFile } };
};
