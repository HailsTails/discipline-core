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

export const dynamicLoadMatching =
  (request: { readonly specifier: RegExp }): ImportAllowance =>
  ({ moduleImport }) =>
    request.specifier.test(moduleImport.specifier) && moduleImport.form === "dynamic" ? "allowed" : "outside";

export const importNotMatching =
  (request: { readonly specifier: RegExp }): ImportAllowance =>
  ({ moduleImport }) =>
    request.specifier.test(moduleImport.specifier) ? "outside" : "allowed";

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

const MODULE_STATEMENT = /^(import|export)\s[^;]*?from\s+["']([^"']+)["'];/gm;

export type ImportStatement = { readonly file: string; readonly statement: string };

type ModuleStatementKind = "import" | "re-export";

type ModuleStatement = ImportStatement & { readonly kind: ModuleStatementKind };

const kindOf = (request: { readonly keyword: string }): ModuleStatementKind => (request.keyword === "import" ? "import" : "re-export");

const statementsReaching = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly specifier: RegExp;
}): readonly ModuleStatement[] =>
  Object.entries(request.sources).flatMap(([file, text]) =>
    [...text.matchAll(MODULE_STATEMENT)]
      .filter(([, , specifier]) => request.specifier.test(specifier ?? ""))
      .map(([statement, keyword]) => ({ file, statement, kind: kindOf({ keyword: keyword ?? "" }) })),
  );

export const importStatementsReaching = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly specifier: RegExp;
}): readonly ImportStatement[] =>
  statementsReaching(request)
    .filter(({ kind }) => kind === "import")
    .map(({ file, statement }) => ({ file, statement }));

export type ImportFacts = {
  readonly file: string;
  readonly kind: ModuleStatementKind;
  readonly specifier: string;
  readonly form: "type-only" | "value";
  readonly names: readonly string[];
};

const TYPE_ONLY_STATEMENT = /^(?:import|export)\s+type\s/;

const STATEMENT_CLAUSE = /^(?:import|export)\s+(?:type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["'];$/;

const BRACED_NAMES = /^\{([\s\S]*)\}$/;

const formOf = (request: { readonly statement: string }): ImportFacts["form"] =>
  TYPE_ONLY_STATEMENT.test(request.statement) ? "type-only" : "value";

const namesOf = (request: { readonly clause: string }): readonly string[] =>
  (BRACED_NAMES.exec(request.clause)?.[1] ?? request.clause)
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");

export const importFactsReaching = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly specifier: RegExp;
}): readonly ImportFacts[] =>
  statementsReaching(request).flatMap(({ file, statement, kind }) => {
    const parts = STATEMENT_CLAUSE.exec(statement);
    return parts === null
      ? []
      : [
          {
            file,
            kind,
            specifier: parts[2] ?? "",
            form: formOf({ statement }),
            names: namesOf({ clause: parts[1] ?? "" }),
          },
        ];
  });

const STATIC_FORMS_FOUND: readonly ModuleImport["form"][] = ["value", "type-only"];

export type UnfactedImports = {
  readonly file: string;
  readonly specifier: string;
  readonly found: number;
  readonly withFacts: number;
};

export const importsWithoutFacts = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly specifier: RegExp;
}): readonly UnfactedImports[] => {
  const facts = importFactsReaching(request);
  return Object.entries(request.sources).flatMap(([file, text]) => {
    const found = importsIn({ text }).filter(
      (moduleImport) => STATIC_FORMS_FOUND.includes(moduleImport.form) && request.specifier.test(moduleImport.specifier),
    );
    return [...new Set(found.map(({ specifier }) => specifier))].flatMap((specifier) => {
      const foundCount = found.filter((moduleImport) => moduleImport.specifier === specifier).length;
      const withFacts = facts.filter((fact) => fact.file === file && fact.specifier === specifier).length;
      return foundCount === withFacts ? [] : [{ file, specifier, found: foundCount, withFacts }];
    });
  });
};

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
