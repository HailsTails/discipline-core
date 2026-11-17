import type { RunnerFailure } from "../core/mechanism-port/runner-failure.ts";
import type { Result } from "../core/values/result.ts";
import type { SyntaxApi, SyntaxNode, TypeScriptParsePort } from "../mechanisms/audit/runner/typescript-parse.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../mechanisms/audit/runner/typescript-toolchain.ts";
import type { DeclarationEmit, DeclarationFailure, DeclarationPort, EmittedDeclaration } from "./package-declarations.ts";

type Program = ReturnType<SyntaxApi["createProgram"]>;

type CompilerOptions = Program extends { readonly getCompilerOptions: () => infer Options } ? Options : never;

type CustomTransformers = NonNullable<Parameters<Program["emit"]>[4]>;

type DeclarationTransformerFactory = NonNullable<CustomTransformers["afterDeclarations"]>[number];

type Diagnostic = ReturnType<SyntaxApi["getPreEmitDiagnostics"]>[number];

type Statement = ReturnType<SyntaxApi["createSourceFile"]>["statements"][number];

type ParsePortLoader = (request: { readonly installRoot: string }) => Promise<Result<TypeScriptParsePort, RunnerFailure>>;

type Emitted = Result<DeclarationEmit, DeclarationFailure>;

const PROJECT_CONFIG = "tsconfig.json";

const SOURCE_SPECIFIER = /^(\.\.?\/.*)\.ts$/;

const DECLARATION_FILE = /\.d\.ts$/;

const declarationsFailed = (request: { readonly detail: string }): Emitted => ({
  outcome: "failed",
  error: { kind: "declarations-failed", detail: request.detail },
});

const repositoryRootOf = (request: { readonly syntaxApi: SyntaxApi; readonly sourceRoot: string }): string =>
  `${request.syntaxApi.sys.resolvePath(request.sourceRoot).replaceAll("\\", "/")}/`;

const repositoryPathOf = (request: { readonly root: string; readonly fileName: string }): string =>
  request.fileName.replaceAll("\\", "/").replace(request.root, "");

const publishedSpecifier = (request: { readonly specifier: string }): string => request.specifier.replace(SOURCE_SPECIFIER, "$1.js");

const declaresExportedValue = (request: { readonly syntaxApi: SyntaxApi; readonly statement: Statement }): "value" | "type-or-private" => {
  const syntaxApi = request.syntaxApi;
  const statement = request.statement;
  const valueKind =
    syntaxApi.isVariableStatement(statement) ||
    syntaxApi.isFunctionDeclaration(statement) ||
    syntaxApi.isClassDeclaration(statement) ||
    syntaxApi.isEnumDeclaration(statement);
  const exported =
    syntaxApi.canHaveModifiers(statement) && (syntaxApi.getModifiers(statement) ?? []).some((modifier) => modifier.kind === syntaxApi.SyntaxKind.ExportKeyword);
  return (valueKind && exported) || syntaxApi.isExportAssignment(statement) ? "value" : "type-or-private";
};

const publishedLiteral = (request: { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode }): SyntaxNode =>
  request.syntaxApi.isStringLiteral(request.node) && SOURCE_SPECIFIER.test(request.node.text)
    ? request.syntaxApi.factory.createStringLiteral(publishedSpecifier({ specifier: request.node.text }))
    : request.node;

const publishedImportType = (request: { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode }): SyntaxNode =>
  request.syntaxApi.isLiteralTypeNode(request.node) && request.syntaxApi.isStringLiteral(request.node.literal)
    ? request.syntaxApi.factory.createLiteralTypeNode(
        request.syntaxApi.factory.createStringLiteral(publishedSpecifier({ specifier: request.node.literal.text })),
      )
    : request.node;

const publicationTransformer =
  (request: { readonly syntaxApi: SyntaxApi }): DeclarationTransformerFactory =>
  (context) => {
    const syntaxApi = request.syntaxApi;
    const visit = (node: SyntaxNode): SyntaxNode => {
      if (syntaxApi.isImportDeclaration(node) || syntaxApi.isExportDeclaration(node)) {
        return syntaxApi.visitEachChild(
          node,
          (child) => (child === node.moduleSpecifier ? publishedLiteral({ syntaxApi, node: child }) : visit(child)),
          context,
        );
      }
      if (syntaxApi.isImportTypeNode(node)) {
        return syntaxApi.visitEachChild(node, (child) => (child === node.argument ? publishedImportType({ syntaxApi, node: child }) : visit(child)), context);
      }
      return syntaxApi.visitEachChild(node, visit, context);
    };
    return (root) =>
      syntaxApi.isSourceFile(root)
        ? syntaxApi.factory.updateSourceFile(
            root,
            syntaxApi.visitNodes(
              syntaxApi.factory.createNodeArray(root.statements.filter((statement) => declaresExportedValue({ syntaxApi, statement }) === "type-or-private")),
              visit,
              syntaxApi.isStatement,
            ),
          )
        : root;
  };

const diagnosticText = (request: { readonly syntaxApi: SyntaxApi; readonly root: string; readonly diagnostic: Diagnostic }): string => {
  const message = request.syntaxApi.flattenDiagnosticMessageText(request.diagnostic.messageText, " ");
  return request.diagnostic.file === undefined
    ? message
    : `${repositoryPathOf({ root: request.root, fileName: request.diagnostic.file.fileName })}: ${message}`;
};

const specifiersIn = (request: { readonly syntaxApi: SyntaxApi; readonly text: string }): readonly string[] => {
  const scanned = request.syntaxApi.preProcessFile(request.text, true, true);
  return [...scanned.importedFiles, ...scanned.typeReferenceDirectives].map((reference) => reference.fileName);
};

const projectOptionsOf = (request: { readonly syntaxApi: SyntaxApi; readonly root: string }): Result<CompilerOptions, string> => {
  const syntaxApi = request.syntaxApi;
  const read = syntaxApi.readConfigFile(`${request.root}${PROJECT_CONFIG}`, syntaxApi.sys.readFile);
  if (read.error !== undefined) {
    return { outcome: "failed", error: syntaxApi.flattenDiagnosticMessageText(read.error.messageText, " ") };
  }
  const parsed = syntaxApi.parseJsonConfigFileContent(read.config, syntaxApi.sys, request.root);
  return { outcome: "ok", value: { ...parsed.options, noEmit: false, declaration: true, emitDeclarationOnly: true } };
};

const emittedWith = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly root: string;
  readonly options: CompilerOptions;
  readonly entryPoints: readonly string[];
}): DeclarationEmit => {
  const syntaxApi = request.syntaxApi;
  const written = new Map<string, string>();
  const host = syntaxApi.createCompilerHost(request.options);
  const program = syntaxApi.createProgram({
    rootNames: request.entryPoints.map((entryPoint) => `${request.root}${entryPoint}`),
    options: request.options,
    host: {
      ...host,
      writeFile: (fileName, text) => {
        written.set(repositoryPathOf({ root: request.root, fileName }), text);
      },
    },
  });
  const emitted = program.emit(undefined, undefined, undefined, true, { afterDeclarations: [publicationTransformer({ syntaxApi })] });
  const declarations: readonly EmittedDeclaration[] = [...written]
    .filter(([path]) => DECLARATION_FILE.test(path))
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([path, text]) => ({ path, text, specifiers: specifiersIn({ syntaxApi, text }) }));
  return {
    declarations,
    diagnostics: [...syntaxApi.getPreEmitDiagnostics(program), ...emitted.diagnostics].map((diagnostic) =>
      diagnosticText({ syntaxApi, root: request.root, diagnostic }),
    ),
  };
};

const emittedBy = (request: { readonly syntaxApi: SyntaxApi; readonly sourceRoot: string; readonly entryPoints: readonly string[] }): Emitted => {
  const root = repositoryRootOf(request);
  const options = projectOptionsOf({ syntaxApi: request.syntaxApi, root });
  return options.outcome === "failed"
    ? declarationsFailed({ detail: `read ${PROJECT_CONFIG}: ${options.error}` })
    : { outcome: "ok", value: emittedWith({ syntaxApi: request.syntaxApi, root, options: options.value, entryPoints: request.entryPoints }) };
};

export const createTypeScriptDeclarationPort = (options: { readonly load: ParsePortLoader }): DeclarationPort => ({
  emit: async (request) => {
    const parsePort = await options.load({ installRoot: request.sourceRoot });
    return parsePort.outcome === "failed"
      ? declarationsFailed({ detail: `load typescript: ${parsePort.error.kind}` })
      : emittedBy({ syntaxApi: parsePort.value.syntaxApi, sourceRoot: request.sourceRoot, entryPoints: request.entryPoints });
  },
});

export const createDefaultTypeScriptDeclarationPort = (_options: Record<string, never>): DeclarationPort =>
  createTypeScriptDeclarationPort({
    load: (request) => loadParsePort({ peers: defaultTypeScriptPeers({ installRoot: request.installRoot, installForm: "source" }) }),
  });
