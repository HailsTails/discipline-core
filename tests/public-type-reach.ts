import type { Result } from "../core/values/result.ts";
import type { SyntaxApi } from "../mechanisms/audit/runner/typescript-parse.ts";
import {
  type DeclarationEmit,
  type DeclarationFailure,
  type EmittedDeclaration,
  type PublicTypeEntry,
  publishedDeclarationsOf,
  reachableDeclarations,
  typedExportOf,
} from "../scripts/package-declarations.ts";

export type EntryReach = { readonly reached: readonly string[]; readonly packageImports: readonly string[] };

export type PublicTypeReach = {
  readonly problems: readonly string[];
  readonly entries: Readonly<Record<string, EntryReach>>;
  readonly valueDeclaring: readonly string[];
  readonly zodMentioning: readonly string[];
};

const RELATIVE_SPECIFIER = /^\.\.?\//;

const DECLARATION_FILE = /\.d\.ts$/;

type Statement = ReturnType<SyntaxApi["createSourceFile"]>["statements"][number];

type StatementRequest = { readonly syntaxApi: SyntaxApi; readonly statement: Statement };

const valueNamesOf = (request: StatementRequest): readonly string[] => {
  const syntaxApi = request.syntaxApi;
  const statement = request.statement;
  if (syntaxApi.isVariableStatement(statement)) {
    return statement.declarationList.declarations.map((declaration) => declaration.name.getText());
  }
  return (syntaxApi.isFunctionDeclaration(statement) || syntaxApi.isClassDeclaration(statement) || syntaxApi.isEnumDeclaration(statement) || syntaxApi.isModuleDeclaration(statement)) &&
    statement.name !== undefined
    ? [statement.name.text]
    : [];
};

const exportKeywordOf = (request: StatementRequest): "exported" | "local" =>
  request.syntaxApi.canHaveModifiers(request.statement) &&
  (request.syntaxApi.getModifiers(request.statement) ?? []).some((modifier) => modifier.kind === request.syntaxApi.SyntaxKind.ExportKeyword)
    ? "exported"
    : "local";

const valueClaimsOf = (request: StatementRequest & { readonly localValues: ReadonlySet<string> }): readonly string[] => {
  const syntaxApi = request.syntaxApi;
  const statement = request.statement;
  if (syntaxApi.isExportAssignment(statement)) {
    return [statement.getText()];
  }
  if (syntaxApi.isExportDeclaration(statement)) {
    if (statement.isTypeOnly) return [];
    if (statement.moduleSpecifier !== undefined || statement.exportClause === undefined || !syntaxApi.isNamedExports(statement.exportClause)) return [statement.getText()];
    return statement.exportClause.elements
      .filter((element) => !element.isTypeOnly && request.localValues.has((element.propertyName ?? element.name).text))
      .map((element) => element.getText());
  }
  return exportKeywordOf(request) === "exported" ? valueNamesOf(request) : [];
};

export const valueClaimsIn = (request: { readonly syntaxApi: SyntaxApi; readonly text: string }): readonly string[] => {
  const sourceFile = request.syntaxApi.createSourceFile("shipped.d.ts", request.text, request.syntaxApi.ScriptTarget.Latest, true);
  const localValues = new Set(sourceFile.statements.flatMap((statement) => valueNamesOf({ syntaxApi: request.syntaxApi, statement })));
  return sourceFile.statements.flatMap((statement) => valueClaimsOf({ syntaxApi: request.syntaxApi, statement, localValues }));
};
const entryReachOf = (request: { readonly declarations: readonly EmittedDeclaration[]; readonly entry: PublicTypeEntry }): EntryReach => {
  const reached = reachableDeclarations({ declarations: request.declarations, roots: [typedExportOf({ entry: request.entry }).declaration] });
  const packageImports = request.declarations
    .filter((declaration) => reached.includes(declaration.path))
    .flatMap((declaration) => declaration.specifiers.filter((specifier) => !RELATIVE_SPECIFIER.test(specifier)));
  return { reached, packageImports: [...new Set(packageImports)].sort() };
};

const reachOfEmit = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly emit: DeclarationEmit;
  readonly entries: readonly PublicTypeEntry[];
  readonly requiredPeers: readonly string[];
}): PublicTypeReach => {
  const published = publishedDeclarationsOf({ emit: request.emit, entries: request.entries, requiredPeers: request.requiredPeers });
  const shipped = published.outcome === "ok" ? published.value.filter((file) => DECLARATION_FILE.test(file.path)) : [];
  return {
    problems: published.outcome === "failed" ? published.error : [],
    entries: Object.fromEntries(request.entries.map((entry) => [entry.subpath, entryReachOf({ declarations: request.emit.declarations, entry })])),
    valueDeclaring: shipped.flatMap((file) => valueClaimsIn({ syntaxApi: request.syntaxApi, text: file.text }).map((claim) => `${file.path}: ${claim}`)),
    zodMentioning: shipped.filter((file) => file.text.includes("zod")).map((file) => file.path),
  };
};

export const publicTypeReachOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly emitted: Result<DeclarationEmit, DeclarationFailure>;
  readonly entries: readonly PublicTypeEntry[];
  readonly requiredPeers: readonly string[];
}): PublicTypeReach =>
  request.emitted.outcome === "failed"
    ? { problems: [request.emitted.error.detail], entries: {}, valueDeclaring: [], zodMentioning: [] }
    : reachOfEmit({ syntaxApi: request.syntaxApi, emit: request.emitted.value, entries: request.entries, requiredPeers: request.requiredPeers });
