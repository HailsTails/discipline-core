import type { BundledOutput } from "./esbuild-bundler-port.ts";
import { builtModulePath } from "./package-plan.ts";
import type { LockedPackage } from "./pnpm-lock.ts";

export type BundledPackageVersion = { readonly root: string; readonly name: string; readonly version: string };

export type ShippedText = { readonly path: string; readonly text: string };

const BUILTIN_PREFIX = "node:";

const PAGE_SUFFIX = ".md";

const STAGED_PACKAGES_FOLDER = "node_modules";

const RELATIVE_LINK = /\]\(([^)\s]+)\)/g;

const PACKAGE_PATH = "/package/";

const PACKAGE_BASE = `file://${PACKAGE_PATH}`;

const NOT_RELATIVE = /^(?:[a-z][a-z0-9+.-]*:|#)/i;

type ExternalImport = "builtin" | "peer" | "unbundled";

const externalImportOf = (request: { readonly specifier: string; readonly peers: readonly string[] }): ExternalImport => {
  if (request.specifier.startsWith(BUILTIN_PREFIX)) {
    return "builtin";
  }
  return request.peers.some((peer) => request.specifier === peer || request.specifier.startsWith(`${peer}/`)) ? "peer" : "unbundled";
};

export const unbundledImportsOf = (request: {
  readonly outputs: readonly BundledOutput[];
  readonly peers: readonly string[];
}): readonly string[] =>
  request.outputs.flatMap((output) =>
    output.externalImports
      .filter((specifier) => externalImportOf({ specifier, peers: request.peers }) === "unbundled")
      .map((specifier) => `${output.path} imports ${specifier}`),
  );

type EntryPlacement = "in-place" | "misplaced";

const entryPlacementOf = (request: { readonly entryPoint: string; readonly outputs: readonly BundledOutput[] }): EntryPlacement =>
  request.outputs.some(
    (output) =>
      output.path === builtModulePath({ path: request.entryPoint }) &&
      output.entryPoint === request.entryPoint &&
      output.inputs.includes(request.entryPoint),
  )
    ? "in-place"
    : "misplaced";

export const misplacedEntriesOf = (request: {
  readonly entryPoints: readonly string[];
  readonly outputs: readonly BundledOutput[];
}): readonly string[] =>
  request.entryPoints
    .filter((entryPoint) => entryPlacementOf({ entryPoint, outputs: request.outputs }) === "misplaced")
    .map((entryPoint) => `${entryPoint} is not emitted with its own code at ${builtModulePath({ path: entryPoint })}`);

const stagedRootOf = (request: { readonly name: string }): string => `${STAGED_PACKAGES_FOLDER}/${request.name}`;

const rootProblemOf = (request: { readonly bundled: BundledPackageVersion; readonly label: string }): readonly string[] => {
  const staged = stagedRootOf({ name: request.bundled.name });
  return request.bundled.root === staged ? [] : [`${request.label}, which is not the staged ${staged}`];
};

const versionProblemOf = (request: {
  readonly bundled: BundledPackageVersion;
  readonly label: string;
  readonly closure: readonly LockedPackage[];
}): readonly string[] => {
  const held = request.closure.filter((locked) => locked.name === request.bundled.name);
  if (held.length === 0) {
    return [`${request.label}, which is not in the closure of core's dependencies in the lock`];
  }
  return held.some((locked) => locked.version === request.bundled.version)
    ? []
    : [`${request.label}, but the lock holds ${held.map((locked) => locked.version).join(", ")}`];
};

const lockProblemOf = (request: { readonly bundled: BundledPackageVersion; readonly closure: readonly LockedPackage[] }): readonly string[] => {
  const label = `${request.bundled.name} ${request.bundled.version} at ${request.bundled.root}`;
  return [...rootProblemOf({ bundled: request.bundled, label }), ...versionProblemOf({ ...request, label })];
};

export const unlockedPackagesOf = (request: {
  readonly bundled: readonly BundledPackageVersion[];
  readonly closure: readonly LockedPackage[];
}): readonly string[] => request.bundled.flatMap((bundled) => lockProblemOf({ bundled, closure: request.closure }));

const resolvedLink = (request: { readonly page: string; readonly link: string }): string => {
  const pathname = decodeURIComponent(new URL(request.link.split("#")[0], `${PACKAGE_BASE}${request.page}`).pathname);
  const inside = pathname.startsWith(PACKAGE_PATH) ? pathname.slice(PACKAGE_PATH.length) : pathname;
  return inside.endsWith("/") ? inside.slice(0, -1) : inside;
};

type LinkTarget = "shipped" | "dead";

const linkTargetOf = (request: { readonly target: string; readonly paths: readonly string[] }): LinkTarget =>
  request.paths.some((path) => path === request.target || path.startsWith(`${request.target}/`)) ? "shipped" : "dead";

export const deadLinksOf = (request: { readonly files: readonly ShippedText[] }): readonly string[] => {
  const paths = request.files.map((file) => file.path);
  return request.files
    .filter((file) => file.path.endsWith(PAGE_SUFFIX))
    .flatMap((file) =>
      [...file.text.matchAll(RELATIVE_LINK)]
        .map((match) => match[1])
        .filter((link) => !NOT_RELATIVE.test(link))
        .map((link) => resolvedLink({ page: file.path, link }))
        .filter((target) => linkTargetOf({ target, paths }) === "dead")
        .map((target) => `${file.path} links to ${target}`),
    );
};

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

const escapedForPattern = (request: { readonly text: string }): string => request.text.replace(REGEX_SPECIAL, "\\$&");

const versionedTarballPatternOf = (request: { readonly tarballStem: string }): RegExp =>
  new RegExp(`${escapedForPattern({ text: request.tarballStem })}-\\d[^\\s\`/]*?\\.tgz`, "g");

const versionTokenPatternOf = (request: { readonly version: string }): RegExp =>
  new RegExp(`(?<![0-9A-Za-z.-])v?${escapedForPattern({ text: request.version })}(?![0-9A-Za-z+-]|\\.\\d)`, "g");

export const versionMentionsOf = (request: {
  readonly files: readonly ShippedText[];
  readonly tarballStem: string;
  readonly version: string;
}): readonly string[] => {
  const patterns = [versionedTarballPatternOf({ tarballStem: request.tarballStem }), versionTokenPatternOf({ version: request.version })];
  return request.files
    .filter((file) => file.path.endsWith(PAGE_SUFFIX))
    .flatMap((file) => patterns.flatMap((pattern) => [...file.text.matchAll(pattern)].map((match) => `${file.path} names ${match[0]}`)));
};