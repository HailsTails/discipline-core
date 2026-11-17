import { assert, describe, expect, it } from "vitest";
import type { SyntaxApi } from "../mechanisms/audit/runner/typescript-parse.ts";
import { defaultParsePort } from "./typescript-parse-port.ts";

type CompilerOptions = Parameters<SyntaxApi["createCompilerHost"]>[0];

type CompilerHost = ReturnType<SyntaxApi["createCompilerHost"]>;

const syntaxApi: SyntaxApi = defaultParsePort.syntaxApi;

const REPO_ROOT = syntaxApi.sys.resolvePath(`${import.meta.dirname}/..`).replaceAll("\\", "/");

const PROBE_PATH = `${REPO_ROOT}/public-type-probe.ts`;

const PROBE_DECLARATION = "public-type-probe.d.ts";

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

const AUTHORING_AUDIT_PROBE = [
  'export type { PieceHit, PreparedFileCheck, PreparedWalkerCheck, SourceObservers, WalkerFile, WalkerPiece, WalkerRepository } from "./mechanisms/audit/runner/walker-piece.ts";',
  'export type { CommentRange, SyntaxApi, SyntaxNode, SyntaxTree } from "./mechanisms/audit/runner/typescript-parse.ts";',
  'export type { RunnerClause } from "./core/mechanism-port/runner-module-types.ts";',
  'export type { PeerKind, RunnerFailure } from "./core/mechanism-port/runner-failure.ts";',
  'export type { Hit } from "./core/mechanism-port/runner-result-types.ts";',
  'export type { ClauseAddress } from "./core/values/clause-address-types.ts";',
  'export type { ClauseId, DisciplineId, MechanismId, RuleSetName } from "./core/values/identifier-types.ts";',
  'export type { Anchor, AnchorKind } from "./core/values/anchor.ts";',
  'export type { RepoPath } from "./core/values/repo-path-types.ts";',
  'export type { Result } from "./core/values/result.ts";',
  "",
].join("\n");

const AUTHORING_RULE_SET_PROBE = [
  'export type { ClauseDefinition, ClauseExceptions, DisciplineFile, PieceFile, SourceCase } from "./core/rule-set-reader/rule-set-types.ts";',
  'export type { EslintPieceSettings, RuleOptions } from "./mechanisms/eslint/runner/eslint-piece-settings-types.ts";',
  'export type { JsonValue } from "./core/values/json-value.ts";',
  "",
].join("\n");

const SCHEMA_PROBE = 'export { repoPathSchema } from "./core/values/repo-path.ts";\n';

const repositoryForm = (request: { readonly path: string }): string => request.path.replaceAll("\\", "/");

const probeHostOf = (request: { readonly probeSource: string; readonly emitted: Map<string, string> }): CompilerHost => {
  const host = syntaxApi.createCompilerHost(PROBE_COMPILER_OPTIONS);
  const isProbe = (fileName: string): boolean => repositoryForm({ path: fileName }) === PROBE_PATH;
  return {
    ...host,
    fileExists: (fileName) => isProbe(fileName) || host.fileExists(fileName),
    readFile: (fileName) => (isProbe(fileName) ? request.probeSource : host.readFile(fileName)),
    getSourceFile: (fileName, languageVersion, onError, shouldCreate) =>
      isProbe(fileName)
        ? syntaxApi.createSourceFile(fileName, request.probeSource, languageVersion, true)
        : host.getSourceFile(fileName, languageVersion, onError, shouldCreate),
    writeFile: (fileName, text) => {
      request.emitted.set(repositoryForm({ path: fileName }), text);
    },
  };
};

const specifiersIn = (request: { readonly text: string }): readonly string[] => {
  const scanned = syntaxApi.preProcessFile(request.text, true, true);
  return [...scanned.importedFiles, ...scanned.typeReferenceDirectives].map((reference) => reference.fileName);
};

const declarationReachedBy = (request: { readonly from: string; readonly specifier: string }): string =>
  new URL(request.specifier, `file:///${request.from}`).pathname.slice(1).replace(SOURCE_EXTENSION, DECLARATION_EXTENSION);

const reachableFrom = (request: {
  readonly emitted: ReadonlyMap<string, string>;
  readonly reached: ReadonlySet<string>;
  readonly frontier: readonly string[];
}): ReadonlySet<string> => {
  const next = request.frontier
    .flatMap((from) =>
      specifiersIn({ text: request.emitted.get(from) ?? "" })
        .filter((specifier) => RELATIVE_SPECIFIER.test(specifier))
        .map((specifier) => declarationReachedBy({ from, specifier })),
    )
    .filter((declaration) => !request.reached.has(declaration));
  const unique = [...new Set(next)];
  return unique.length === 0
    ? request.reached
    : reachableFrom({ emitted: request.emitted, reached: new Set([...request.reached, ...unique]), frontier: unique });
};

const emittedDeclarationsOf = (request: { readonly probeSource: string }): ReadonlyMap<string, string> => {
  const emitted = new Map<string, string>();
  syntaxApi
    .createProgram({ rootNames: [PROBE_PATH], options: PROBE_COMPILER_OPTIONS, host: probeHostOf({ probeSource: request.probeSource, emitted }) })
    .emit(undefined, undefined, undefined, true);
  return new Map([...emitted].map(([path, text]) => [path.slice(REPO_ROOT.length + 1), text]));
};

const packageImportsOf = (request: { readonly probeSource: string }): readonly string[] => {
  const emitted = emittedDeclarationsOf(request);
  assert(emitted.has(PROBE_DECLARATION), "the probe itself is emitted, so its graph can be walked");
  const reached = [...reachableFrom({ emitted, reached: new Set([PROBE_DECLARATION]), frontier: [PROBE_DECLARATION] })].sort();
  assert(
    reached.every((declaration) => emitted.has(declaration)),
    "every relative specifier in a reached declaration names an emitted declaration",
  );
  return [
    ...new Set(
      reached.flatMap((declaration) => specifiersIn({ text: emitted.get(declaration) ?? "" })).filter((specifier) => !RELATIVE_SPECIFIER.test(specifier)),
    ),
  ].sort();
};

describe("declarations reachable from the planned public authoring types, emitted in memory with the repository's own TypeScript (CD-47: nothing is spawned or written)", () => {
  it("import no package but typescript for the audit authoring types", () => {
    expect(packageImportsOf({ probeSource: AUTHORING_AUDIT_PROBE })).toEqual(["typescript"]);
  });

  it("import no package at all for the rule-set authoring types", () => {
    expect(packageImportsOf({ probeSource: AUTHORING_RULE_SET_PROBE })).toEqual([]);
  });

  it("see zod where a schema is exported, so the scan is not vacuous", () => {
    expect(packageImportsOf({ probeSource: SCHEMA_PROBE })).toEqual(["zod"]);
  });
});
