import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import { loadedPeer, type PeerToolchain, type ToolchainRequirement } from "../../../core/mechanism-port/toolchain-requirement.ts";
import { createDefaultPackageLocationPort } from "../../../core/platform-ports/package-location-port.ts";
import type { InstallForm } from "../../../core/values/install-layout.ts";
import type { Result } from "../../../core/values/result.ts";
import { createParsePort, defaultTypeScriptModules, type TypeScriptModules, type TypeScriptParsePort } from "./typescript-parse.ts";

export type TypeScriptPeers = PeerToolchain<TypeScriptModules>;

export const TYPESCRIPT_REQUIREMENT: ToolchainRequirement = {
  packageName: "typescript",
  peer: "required",
  lines: [{ floor: "4.8.4", below: "7.0.0" }],
};

export const defaultTypeScriptPeers = (options: { readonly installRoot: string; readonly installForm: InstallForm }): TypeScriptPeers => ({
  location: createDefaultPackageLocationPort(options),
  modules: defaultTypeScriptModules,
});

export const loadParsePort = (request: { readonly peers: TypeScriptPeers }): Promise<Result<TypeScriptParsePort, RunnerFailure>> =>
  loadedPeer({
    requirement: TYPESCRIPT_REQUIREMENT,
    location: request.peers.location,
    load: request.peers.modules.typescript,
    versionOf: (loaded) => loaded.default.version,
  }).then((loaded) =>
    loaded.outcome === "failed" ? loaded : { outcome: "ok", value: createParsePort({ syntaxApi: loaded.value.default }) },
  );
