import type { BundledOutput } from "./esbuild-bundler-port.ts";
import { builtModulePath } from "./package-plan.ts";
import type { LockedPackage } from "./pnpm-lock.ts";
import type { DependencyPins } from "./published-manifest.ts";

export type ShippedText = { readonly path: string; readonly text: string };

const BUILTIN_PREFIX = "node:";

const PAGE_SUFFIX = ".md";

const RELATIVE_LINK = /\]\(([^)\s]+)\)/g;

const PACKAGE_PATH = "/package/";

const PACKAGE_BASE = `file://${PACKAGE_PATH}`;

const NOT_RELATIVE = /^(?:[a-z][a-z0-9+.-]*:|#)/i;

type ExternalImport = "builtin" | "declared" | "undeclared";

const externalImportOf = (request: { readonly specifier: string; readonly declared: readonly string[] }): ExternalImport => {
  if (request.specifier.startsWith(BUILTIN_PREFIX)) {
    return "builtin";
  }
  return request.declared.some((name) => request.specifier === name || request.specifier.startsWith(`${name}/`)) ? "declared" : "undeclared";
};

export const undeclaredImportsOf = (request: {
  readonly outputs: readonly BundledOutput[];
  readonly declared: readonly string[];
}): readonly string[] =>
  request.outputs.flatMap((output) =>
    output.externalImports
      .filter((specifier) => externalImportOf({ specifier, declared: request.declared }) === "undeclared")
      .map((specifier) => `${output.path} imports ${specifier}`),
  );

export const bundledPackageCodeOf = (request: { readonly packageRoots: readonly string[] }): readonly string[] =>
  request.packageRoots.map((root) => `${root} is bundled into the package`);

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

const pinProblemOf = (request: { readonly name: string; readonly pin: string; readonly locked: readonly LockedPackage[] }): readonly string[] => {
  const held = request.locked.find((locked) => locked.name === request.name);
  if (held === undefined) {
    return [`${request.name} is pinned at ${request.pin}, but the lock holds no version of it`];
  }
  return held.version === request.pin ? [] : [`${request.name} is pinned at ${request.pin}, but the lock holds ${held.version}`];
};

export const unlockedPinsOf = (request: { readonly pins: DependencyPins; readonly locked: readonly LockedPackage[] }): readonly string[] =>
  Object.entries(request.pins).flatMap(([name, pin]) => pinProblemOf({ name, pin, locked: request.locked }));

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