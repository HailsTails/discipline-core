import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { Result } from "../core/values/result.ts";
import type { ScratchFilesPort } from "./install-proof-ports.ts";
import type { ClosureMember, RequirementKind } from "./pnpm-lock.ts";

export type InstalledPackage = { readonly name: string; readonly folder: string };

type Lookup = { readonly name: string; readonly nodeModules: string; readonly kind: RequirementKind };

type Located = Result<readonly InstalledPackage[], string>;

const NAME_SEPARATOR = "/";

const folderAbove = (request: { readonly path: PathPort; readonly folder: string; readonly levels: number }): string =>
  request.levels === 0
    ? request.folder
    : folderAbove({ path: request.path, folder: request.path.directoryOf({ path: request.folder }), levels: request.levels - 1 });

const locatedFrom = (request: {
  readonly pending: readonly Lookup[];
  readonly found: readonly InstalledPackage[];
  readonly closure: readonly ClosureMember[];
  readonly path: PathPort;
  readonly scratch: Pick<ScratchFilesPort, "realPathOf">;
}): Located => {
  const [next, ...rest] = request.pending;
  if (next === undefined) {
    return { outcome: "ok", value: request.found };
  }
  if (request.found.some((installed) => installed.name === next.name)) {
    return locatedFrom({ ...request, pending: rest });
  }
  const segments = next.name.split(NAME_SEPARATOR);
  const linkPath = request.path.join({ segments: [next.nodeModules, ...segments] });
  const real = request.scratch.realPathOf({ path: linkPath });
  if (real.outcome === "failed") {
    return next.kind === "optional"
      ? locatedFrom({ ...request, pending: rest })
      : { outcome: "failed", error: `${next.name} is not installed at ${linkPath}: ${real.error.detail}` };
  }
  const member = request.closure.find((candidate) => candidate.name === next.name);
  if (member === undefined) {
    return { outcome: "failed", error: `${next.name} is installed at ${linkPath} but is not in the closure of core's dependencies` };
  }
  const siblings = folderAbove({ path: request.path, folder: real.value, levels: segments.length });
  return locatedFrom({
    ...request,
    pending: [...rest, ...member.requires.map((required) => ({ name: required.name, nodeModules: siblings, kind: required.kind }))],
    found: [...request.found, { name: next.name, folder: real.value }],
  });
};

export const installedPackagesOf = (request: {
  readonly closure: readonly ClosureMember[];
  readonly direct: readonly string[];
  readonly nodeModules: string;
  readonly path: PathPort;
  readonly scratch: Pick<ScratchFilesPort, "realPathOf">;
}): Located =>
  locatedFrom({
    pending: request.direct.map((name) => ({ name, nodeModules: request.nodeModules, kind: "required" as const })),
    found: [],
    closure: request.closure,
    path: request.path,
    scratch: request.scratch,
  });
