import { importsIn, type ModuleImport } from "../core/check/piece-import-rules.ts";
import { createPathPort, type PathPort } from "../core/platform-ports/path-port.ts";

export type ConfinementVerdict = "allowed" | "outside";

export type ImportAllowance = (request: { readonly moduleImport: ModuleImport }) => ConfinementVerdict;

export type ImportOutside = ModuleImport & { readonly file: string };

export type PathCallsOutside = {
  readonly called: "at least once" | "never";
  readonly outside: readonly string[];
};

const RELATIVE_SPECIFIER = /^\.\.?\//;

const PACKAGE_OR_COMPUTED_SPECIFIER = /^[^.]/;

const NODE_BUILTIN_SPECIFIER = /^node:/;

const COMPUTED_SPECIFIER = /[^\w@/.:-]/;

const STATIC_FORMS: readonly ModuleImport["form"][] = ["value", "type-only"];

const INSTALL_ROOT = "/install";

export const relativeImport: ImportAllowance = ({ moduleImport }) =>
  RELATIVE_SPECIFIER.test(moduleImport.specifier) && STATIC_FORMS.includes(moduleImport.form) ? "allowed" : "outside";

export const relativeImportOfAnyForm: ImportAllowance = ({ moduleImport }) =>
  RELATIVE_SPECIFIER.test(moduleImport.specifier) ? "allowed" : "outside";

export const nodeBuiltinImport: ImportAllowance = ({ moduleImport }) =>
  NODE_BUILTIN_SPECIFIER.test(moduleImport.specifier) && STATIC_FORMS.includes(moduleImport.form)
    ? "allowed"
    : "outside";

export const computedModuleLoad: ImportAllowance = ({ moduleImport }) =>
  COMPUTED_SPECIFIER.test(moduleImport.specifier) && moduleImport.form === "dynamic" ? "allowed" : "outside";

export const packageOrComputedImport: ImportAllowance = ({ moduleImport }) =>
  PACKAGE_OR_COMPUTED_SPECIFIER.test(moduleImport.specifier) ? "allowed" : "outside";

export const packageImport =
  (request: { readonly packageName: string }): ImportAllowance =>
  ({ moduleImport }) =>
    moduleImport.specifier === request.packageName && STATIC_FORMS.includes(moduleImport.form) ? "allowed" : "outside";

export const packageTypeImport =
  (request: { readonly packageName: string }): ImportAllowance =>
  ({ moduleImport }) =>
    moduleImport.specifier === request.packageName && moduleImport.form === "type-only" ? "allowed" : "outside";

export const packageDynamicImport =
  (request: { readonly packageName: string }): ImportAllowance =>
  ({ moduleImport }) =>
    moduleImport.specifier === request.packageName && moduleImport.form === "dynamic" ? "allowed" : "outside";

const reachOf = (request: {
  readonly importingPath: PathPort;
  readonly reach: RegExp;
  readonly specifier: string;
}): ConfinementVerdict => {
  const location = request.importingPath.relative({ from: INSTALL_ROOT, to: request.specifier });
  return location.relation === "within-root" && request.reach.test(location.path) ? "allowed" : "outside";
};

export const relativeImportReaching = (request: {
  readonly importingFolder: string;
  readonly reach: RegExp;
}): ImportAllowance => {
  const importingPath = createPathPort({
    flavour: "posix",
    workingDirectory: () => `${INSTALL_ROOT}/${request.importingFolder}`,
  });
  return ({ moduleImport }) =>
    RELATIVE_SPECIFIER.test(moduleImport.specifier)
      ? reachOf({ importingPath, reach: request.reach, specifier: moduleImport.specifier })
      : "outside";
};

const allowanceOf = (request: {
  readonly allowed: readonly ImportAllowance[];
  readonly moduleImport: ModuleImport;
}): ConfinementVerdict =>
  request.allowed.some((allows) => allows({ moduleImport: request.moduleImport }) === "allowed") ? "allowed" : "outside";

export const importsOutside = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly allowed: readonly ImportAllowance[];
}): readonly ImportOutside[] =>
  Object.entries(request.sources).flatMap(([file, text]) =>
    importsIn({ text })
      .filter((moduleImport) => allowanceOf({ allowed: request.allowed, moduleImport }) === "outside")
      .map((moduleImport) => ({ file, ...moduleImport })),
  );

const folderOfSource = (request: { readonly source: string }): string =>
  request.source.replace(/^\.\//, "").split("/").slice(0, -1).join("/");

export const importsOutsideFromOwnFolder = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly allowedFrom: (request: { readonly importingFolder: string }) => readonly ImportAllowance[];
}): readonly ImportOutside[] =>
  Object.entries(request.sources).flatMap(([file, text]) =>
    importsOutside({
      sources: { [file]: text },
      allowed: request.allowedFrom({ importingFolder: folderOfSource({ source: file }) }),
    }),
  );

const namingOf = (request: { readonly location: string; readonly importingFolder: string; readonly files: readonly string[] }): "names-a-file" | "names-none" =>
  request.files.some((file) => request.location === `${request.importingFolder}/${file}`) ? "names-a-file" : "names-none";

export const relativeImportNotNaming = (request: {
  readonly importingFolder: string;
  readonly files: readonly string[];
}): ImportAllowance => {
  const importingPath = createPathPort({
    flavour: "posix",
    workingDirectory: () => `${INSTALL_ROOT}/${request.importingFolder}`,
  });
  return ({ moduleImport }) => {
    if (!RELATIVE_SPECIFIER.test(moduleImport.specifier)) {
      return "allowed";
    }
    const location = importingPath.relative({ from: INSTALL_ROOT, to: moduleImport.specifier });
    return location.relation === "within-root" && namingOf({ location: location.path, ...request }) === "names-a-file" ? "outside" : "allowed";
  };
};

const fileNameOfSource = (request: { readonly source: string }): string => request.source.split("/").at(-1) ?? "";

export const sourcesNamed = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly files: readonly string[];
}): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(request.sources).filter(([source]) => request.files.includes(fileNameOfSource({ source }))));

export const sourcesNotNamed = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly files: readonly string[];
}): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(request.sources).filter(([source]) => !request.files.includes(fileNameOfSource({ source }))));

const IMPORT_STATEMENT = /^import\s[^;]*?from\s+["']([^"']+)["'];/gm;

export type ImportStatement = { readonly file: string; readonly statement: string };

export const importStatementsReaching = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly specifier: RegExp;
}): readonly ImportStatement[] =>
  Object.entries(request.sources).flatMap(([file, text]) =>
    [...text.matchAll(IMPORT_STATEMENT)]
      .filter(([, specifier]) => request.specifier.test(specifier ?? ""))
      .map(([statement]) => ({ file, statement })),
  );

type ImportGraph = ReadonlyMap<string, readonly string[]>;

const scannedImportsOf = (request: {
  readonly file: string;
  readonly text: string;
  readonly scanned: ReadonlySet<string>;
}): readonly string[] => {
  const importingPath = createPathPort({
    flavour: "posix",
    workingDirectory: () => `${INSTALL_ROOT}/${folderOfSource({ source: request.file })}`,
  });
  return importsIn({ text: request.text })
    .filter(({ specifier }) => RELATIVE_SPECIFIER.test(specifier))
    .flatMap(({ specifier }) => {
      const location = importingPath.relative({ from: INSTALL_ROOT, to: specifier });
      return location.relation === "within-root" ? [`./${location.path}`] : [];
    })
    .filter((resolved) => request.scanned.has(resolved));
};

const reachedFrom = (request: {
  readonly graph: ImportGraph;
  readonly frontier: readonly string[];
  readonly seen: ReadonlySet<string>;
}): ReadonlySet<string> => {
  const fresh = [...new Set(request.frontier.flatMap((file) => request.graph.get(file) ?? []))].filter((file) => !request.seen.has(file));
  return fresh.length === 0 ? request.seen : reachedFrom({ graph: request.graph, frontier: fresh, seen: new Set([...request.seen, ...fresh]) });
};

export const filesReaching = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly startingFrom: RegExp;
  readonly reaching: RegExp;
}): readonly string[] => {
  const scanned = new Set(Object.keys(request.sources));
  const graph: ImportGraph = new Map(
    Object.entries(request.sources).map(([file, text]) => [file, scannedImportsOf({ file, text, scanned })]),
  );
  return [...scanned]
    .filter((file) => request.startingFrom.test(file))
    .filter((file) => [...reachedFrom({ graph, frontier: [file], seen: new Set([file]) })].some((reached) => request.reaching.test(reached)))
    .sort();
};

export const filesReachableFrom = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly startingFrom: RegExp;
  readonly notEntering: RegExp;
}): readonly string[] => {
  const scanned = new Set(Object.keys(request.sources).filter((file) => !request.notEntering.test(file)));
  const graph: ImportGraph = new Map(
    [...scanned].map((file) => [file, scannedImportsOf({ file, text: request.sources[file] ?? "", scanned })]),
  );
  const starts = [...scanned].filter((file) => request.startingFrom.test(file));
  return [...reachedFrom({ graph, frontier: starts, seen: new Set(starts) })].sort();
};

export const sourcesOfFiles = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly files: readonly string[];
}): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(request.sources).filter(([source]) => request.files.includes(source)));

export const sourcesWithout = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly files: readonly string[];
}): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(request.sources).filter(([source]) => !request.files.includes(source)));

export const importStatementsLeaving = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly startingFrom: RegExp;
  readonly notEntering: RegExp;
  readonly specifier: RegExp;
}): readonly ImportStatement[] =>
  importStatementsReaching({
    sources: sourcesOfFiles({ sources: request.sources, files: filesReachableFrom(request) }),
    specifier: request.specifier,
  });

export const filesHoldingStatements = (request: { readonly statements: readonly ImportStatement[] }): readonly string[] =>
  request.statements.map(({ file }) => file);

export const statementsOutsideFiles = (request: {
  readonly statements: readonly ImportStatement[];
  readonly files: RegExp;
}): readonly ImportStatement[] => request.statements.filter(({ file }) => !request.files.test(file));

export const filesNotMatching = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly pattern: RegExp;
}): readonly string[] =>
  Object.entries(request.sources)
    .filter(([, text]) => !request.pattern.test(text))
    .map(([file]) => file);

const pathCallVerdict = (request: {
  readonly path: PathPort;
  readonly root: string;
  readonly observed: string;
  readonly paths: RegExp;
}): ConfinementVerdict => {
  const location = request.path.relative({ from: request.root, to: request.observed });
  return location.relation === "within-root" && request.paths.test(location.path) ? "allowed" : "outside";
};

export const pathCallsOutside = (request: {
  readonly path: PathPort;
  readonly root: string;
  readonly calls: readonly (readonly [{ readonly path: string }])[];
  readonly paths: RegExp;
}): PathCallsOutside => ({
  called: request.calls.length === 0 ? "never" : "at least once",
  outside: request.calls
    .map(([call]) => call.path)
    .filter((observed) => pathCallVerdict({ ...request, observed }) === "outside"),
});
