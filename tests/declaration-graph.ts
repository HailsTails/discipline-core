import type { SyntaxApi } from "../mechanisms/audit/runner/typescript-parse.ts";
import { defaultParsePort } from "./typescript-parse-port.ts";

type CompilerOptions = Parameters<SyntaxApi["createCompilerHost"]>[0];

type CompilerHost = ReturnType<SyntaxApi["createCompilerHost"]>;

type Diagnostic = ReturnType<SyntaxApi["getPreEmitDiagnostics"]>[number];

export type DeclarationReach = {
  readonly reached: readonly string[];
  readonly unemitted: readonly string[];
  readonly packageImports: readonly string[];
  readonly diagnostics: readonly string[];
};

const syntaxApi: SyntaxApi = defaultParsePort.syntaxApi;

const REPO_ROOT = `${syntaxApi.sys.resolvePath(`${import.meta.dirname}/..`).replaceAll("\\", "/")}/`;

const PROBE_NAME = "public-type-probe.ts";

export const PROBE_DECLARATION = "public-type-probe.d.ts";

const RELATIVE_SPECIFIER = /^\.\.?\//;

const SOURCE_EXTENSION = /\.ts$/;

const DECLARATION_EXTENSION = ".d.ts";

const PROBE_COMPILER_OPTIONS: CompilerOptions = {
  target: syntaxApi.ScriptTarget.ESNext,
  module: syntaxApi.ModuleKind.ESNext,
  moduleResolution: syntaxApi.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  resolveJsonModule: true,
  esModuleInterop: true,
  allowImportingTsExtensions: true,
  declaration: true,
  emitDeclarationOnly: true,
  types: ["node"],
};

const repositoryPathOf = (request: { readonly fileName: string }): string =>
  request.fileName.replaceAll("\\", "/").replace(REPO_ROOT, "");

const sourceTextOf = (request: { readonly fileName: string; readonly probeSource: string }): string | undefined =>
  repositoryPathOf(request) === PROBE_NAME ? request.probeSource : syntaxApi.sys.readFile(request.fileName);

const probeHostOf = (request: { readonly probeSource: string; readonly emitted: Map<string, string> }): CompilerHost => {
  const host = syntaxApi.createCompilerHost(PROBE_COMPILER_OPTIONS);
  return {
    ...host,
    fileExists: (fileName) => sourceTextOf({ fileName, probeSource: request.probeSource }) !== undefined,
    readFile: (fileName) => sourceTextOf({ fileName, probeSource: request.probeSource }),
    getSourceFile: (fileName, languageVersion) => {
      const text = sourceTextOf({ fileName, probeSource: request.probeSource });
      return text === undefined ? undefined : syntaxApi.createSourceFile(fileName, text, languageVersion, true);
    },
    writeFile: (fileName, text) => {
      request.emitted.set(repositoryPathOf({ fileName }), text);
    },
  };
};

export const specifiersIn = (request: { readonly text: string }): readonly string[] => {
  const scanned = syntaxApi.preProcessFile(request.text, true, true);
  return [...scanned.importedFiles, ...scanned.typeReferenceDirectives].map((reference) => reference.fileName);
};

export const declarationReachedBy = (request: { readonly from: string; readonly specifier: string }): string =>
  new URL(request.specifier, `file:///${request.from}`).pathname.slice(1).replace(SOURCE_EXTENSION, DECLARATION_EXTENSION);

const reachedFrom = (request: {
  readonly emitted: ReadonlyMap<string, string>;
  readonly reached: ReadonlySet<string>;
  readonly frontier: readonly string[];
}): ReadonlySet<string> => {
  const next = [
    ...new Set(
      request.frontier.flatMap((from) =>
        specifiersIn({ text: request.emitted.get(from) ?? "" })
          .filter((specifier) => RELATIVE_SPECIFIER.test(specifier))
          .map((specifier) => declarationReachedBy({ from, specifier }))
          .filter((declaration) => !request.reached.has(declaration)),
      ),
    ),
  ];
  return next.length === 0
    ? request.reached
    : reachedFrom({ emitted: request.emitted, reached: new Set([...request.reached, ...next]), frontier: next });
};

export const reachableDeclarations = (request: {
  readonly emitted: ReadonlyMap<string, string>;
  readonly root: string;
}): readonly string[] => [...reachedFrom({ emitted: request.emitted, reached: new Set([request.root]), frontier: [request.root] })].sort();

export const packageSpecifiersIn = (request: {
  readonly emitted: ReadonlyMap<string, string>;
  readonly declarations: readonly string[];
}): readonly string[] =>
  [
    ...new Set(
      request.declarations
        .flatMap((declaration) => specifiersIn({ text: request.emitted.get(declaration) ?? "" }))
        .filter((specifier) => !RELATIVE_SPECIFIER.test(specifier)),
    ),
  ].sort();

const diagnosticText = (request: { readonly diagnostic: Diagnostic }): string =>
  `${request.diagnostic.file === undefined ? "" : `${repositoryPathOf({ fileName: request.diagnostic.file.fileName })}: `}${syntaxApi.flattenDiagnosticMessageText(request.diagnostic.messageText, " ")}`;

export const declarationReachOf = (request: { readonly probeSource: string }): DeclarationReach => {
  const emitted = new Map<string, string>();
  const program = syntaxApi.createProgram({
    rootNames: [`${REPO_ROOT}${PROBE_NAME}`],
    options: PROBE_COMPILER_OPTIONS,
    host: probeHostOf({ probeSource: request.probeSource, emitted }),
  });
  const emitDiagnostics = program.emit(undefined, undefined, undefined, true).diagnostics;
  const reached = reachableDeclarations({ emitted, root: PROBE_DECLARATION });
  return {
    reached,
    unemitted: reached.filter((declaration) => !emitted.has(declaration)),
    packageImports: packageSpecifiersIn({ emitted, declarations: reached }),
    diagnostics: [...syntaxApi.getPreEmitDiagnostics(program), ...emitDiagnostics].map((diagnostic) => diagnosticText({ diagnostic })),
  };
};
