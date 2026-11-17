import type typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import { gatheredPeerFailure, installedPeer, loadedPeer, type PeerToolchain, type ToolchainRequirement } from "../../../core/mechanism-port/toolchain-requirement.ts";
import { createDefaultPackageLocationPort } from "../../../core/platform-ports/package-location-port.ts";
import type { InstallForm } from "../../../core/values/install-layout.ts";
import type { Result } from "../../../core/values/result.ts";
import { createEslintOn, type EslintModule, type EslintToolchain, type TypescriptParser } from "./eslint-instance.ts";

export type TypescriptEslintPluginModule = { readonly default: Pick<typeof typescriptEslintPlugin, "meta"> };

export type EslintToolchainModules = {
  readonly eslint: () => Promise<EslintModule>;
  readonly typescriptParser: () => Promise<TypescriptParser>;
  readonly typescriptEslintPlugin: () => Promise<TypescriptEslintPluginModule>;
};

export type EslintToolchainPeers = PeerToolchain<EslintToolchainModules>;

type ToolchainLoad<T> = Promise<Result<T, RunnerFailure>>;

export const ESLINT_REQUIREMENT: ToolchainRequirement = {
  packageName: "eslint",
  peer: "optional",
  lines: [
    { floor: "9.28.0", below: "10.0.0" },
    { floor: "10.0.0", below: "11.0.0" },
  ],
};

export const TYPESCRIPT_ESLINT_PARSER_REQUIREMENT: ToolchainRequirement = {
  packageName: "@typescript-eslint/parser",
  peer: "optional",
  lines: [{ floor: "8.56.0", below: "9.0.0" }],
};

export const TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT: ToolchainRequirement = {
  packageName: "@typescript-eslint/eslint-plugin",
  peer: "optional",
  lines: [{ floor: "8.56.0", below: "9.0.0" }],
};

export const ESLINT_TOOLCHAIN_REQUIREMENTS: readonly ToolchainRequirement[] = [
  ESLINT_REQUIREMENT,
  TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
  TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
];

export const defaultEslintToolchainModules: EslintToolchainModules = {
  eslint: () => import("eslint"),
  typescriptParser: () => import("@typescript-eslint/parser"),
  typescriptEslintPlugin: () => import("@typescript-eslint/eslint-plugin"),
};

export const defaultEslintToolchainPeers = (options: { readonly installRoot: string; readonly installForm: InstallForm }): EslintToolchainPeers => ({
  location: createDefaultPackageLocationPort(options),
  modules: defaultEslintToolchainModules,
});

const failureOf = <Loaded>(request: { readonly loaded: Result<Loaded, RunnerFailure> }): readonly RunnerFailure[] =>
  request.loaded.outcome === "failed" ? [request.loaded.error] : [];

const failedWith = (request: { readonly failures: readonly [RunnerFailure, ...RunnerFailure[]] }): Result<never, RunnerFailure> => ({
  outcome: "failed",
  error: gatheredPeerFailure({ failures: request.failures }),
});

const toolchainOf = (request: {
  readonly eslint: Result<EslintModule, RunnerFailure>;
  readonly typescriptParser: Result<TypescriptParser, RunnerFailure>;
  readonly typescriptEslintPlugin: Result<TypescriptEslintPluginModule, RunnerFailure>;
}): Result<EslintToolchain, RunnerFailure> => {
  if (request.eslint.outcome === "failed") {
    return failedWith({ failures: [request.eslint.error, ...failureOf({ loaded: request.typescriptParser }), ...failureOf({ loaded: request.typescriptEslintPlugin })] });
  }
  if (request.typescriptParser.outcome === "failed") {
    return failedWith({ failures: [request.typescriptParser.error, ...failureOf({ loaded: request.typescriptEslintPlugin })] });
  }
  if (request.typescriptEslintPlugin.outcome === "failed") {
    return failedWith({ failures: [request.typescriptEslintPlugin.error] });
  }
  return {
    outcome: "ok",
    value: {
      eslintVersion: request.eslint.value.ESLint.version,
      createEslint: createEslintOn({ eslintClass: request.eslint.value.ESLint }),
      typescriptParser: request.typescriptParser.value,
    },
  };
};

export const loadEslintToolchain = (request: { readonly peers: EslintToolchainPeers }): ToolchainLoad<EslintToolchain> => {
  const eslint = loadedPeer({
    requirement: ESLINT_REQUIREMENT,
    location: request.peers.location,
    load: request.peers.modules.eslint,
    versionOf: (module) => module.ESLint.version,
  });
  const typescriptParser = loadedPeer({
    requirement: TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
    location: request.peers.location,
    load: request.peers.modules.typescriptParser,
    versionOf: (parser) => parser.version,
  });
  return Promise.all([eslint, typescriptParser]).then(([loadedEslint, loadedParser]) =>
    loadedEslint.outcome === "ok"
      ? loadedPeer({
          requirement: TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
          location: request.peers.location,
          load: request.peers.modules.typescriptEslintPlugin,
          versionOf: (plugin) => plugin.default.meta.version,
        }).then((loadedPlugin) => toolchainOf({ eslint: loadedEslint, typescriptParser: loadedParser, typescriptEslintPlugin: loadedPlugin }))
      : installedPeer({ requirement: TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT, location: request.peers.location }).then((installedPlugin) =>
          failedWith({
            failures: [loadedEslint.error, ...failureOf({ loaded: loadedParser }), ...failureOf({ loaded: installedPlugin })],
          }),
        ),
  );
};
