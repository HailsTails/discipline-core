import type { SyntaxNode, SyntaxTree } from "../mechanisms/audit/runner/typescript-parse.ts";
import { defaultParsePort } from "./typescript-parse-port.ts";

export type ImportForm = "type-only" | "value" | "dynamic";

export type ModuleImport = { readonly specifier: string; readonly form: ImportForm };

type SourceText = { readonly file: string; readonly text: string };

type NodeIn = { readonly node: SyntaxNode; readonly sourceFile: SyntaxTree };

const syntaxApi = defaultParsePort.syntaxApi;

const sourceFileOf = (request: SourceText): SyntaxTree =>
  syntaxApi.createSourceFile(request.file, request.text, syntaxApi.ScriptTarget.Latest, true);

const specifierOf = (request: { readonly expression: SyntaxNode; readonly sourceFile: SyntaxTree }): string =>
  syntaxApi.isStringLiteralLike(request.expression)
    ? request.expression.text
    : request.expression.getText(request.sourceFile);

const declarationImportOf = (request: NodeIn): ModuleImport | undefined => {
  const { node, sourceFile } = request;
  if (syntaxApi.isImportDeclaration(node)) {
    return { specifier: specifierOf({ expression: node.moduleSpecifier, sourceFile }), form: node.importClause?.isTypeOnly === true ? "type-only" : "value" };
  }
  if (syntaxApi.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
    return { specifier: specifierOf({ expression: node.moduleSpecifier, sourceFile }), form: node.isTypeOnly ? "type-only" : "value" };
  }
  return undefined;
};

const importEqualsOf = (request: NodeIn): ModuleImport | undefined => {
  const { node, sourceFile } = request;
  return syntaxApi.isImportEqualsDeclaration(node) && syntaxApi.isExternalModuleReference(node.moduleReference)
    ? { specifier: specifierOf({ expression: node.moduleReference.expression, sourceFile }), form: node.isTypeOnly ? "type-only" : "value" }
    : undefined;
};

const importTypeOf = (request: NodeIn): ModuleImport | undefined => {
  const { node, sourceFile } = request;
  if (!syntaxApi.isImportTypeNode(node)) {
    return undefined;
  }
  const named = syntaxApi.isLiteralTypeNode(node.argument) ? node.argument.literal : node.argument;
  return { specifier: specifierOf({ expression: named, sourceFile }), form: "type-only" };
};

const loadedArgumentOf = (request: NodeIn): SyntaxNode | undefined => {
  const { node } = request;
  if (!syntaxApi.isCallExpression(node)) {
    return undefined;
  }
  const callee = node.expression;
  return callee.kind === syntaxApi.SyntaxKind.ImportKeyword || (syntaxApi.isIdentifier(callee) && callee.text === "require") ? node.arguments[0] : undefined;
};

const loadCallOf = (request: NodeIn): ModuleImport | undefined => {
  const loaded = loadedArgumentOf(request);
  return loaded === undefined ? undefined : { specifier: specifierOf({ expression: loaded, sourceFile: request.sourceFile }), form: "dynamic" };
};

const ownImportOf = (request: NodeIn): ModuleImport | undefined =>
  declarationImportOf(request) ?? importEqualsOf(request) ?? importTypeOf(request) ?? loadCallOf(request);

const childrenOf = (request: { readonly node: SyntaxNode }): readonly SyntaxNode[] => {
  const children: SyntaxNode[] = [];
  syntaxApi.forEachChild(request.node, (child) => {
    children.push(child);
  });
  return children;
};

const importsBelow = (request: NodeIn): readonly ModuleImport[] => {
  const own = ownImportOf(request);
  return [...(own === undefined ? [] : [own]), ...childrenOf(request).flatMap((child) => importsBelow({ node: child, sourceFile: request.sourceFile }))];
};

export const importsIn = (request: SourceText): readonly ModuleImport[] => {
  const sourceFile = sourceFileOf(request);
  return importsBelow({ node: sourceFile, sourceFile });
};

export type ImportStatementIn = { readonly specifier: string; readonly statement: string };

const statementImportOf = (request: NodeIn): ModuleImport | undefined =>
  syntaxApi.isImportDeclaration(request.node) && request.node.importClause === undefined ? undefined : declarationImportOf(request);

export const importStatementsIn = (request: SourceText): readonly ImportStatementIn[] => {
  const sourceFile = sourceFileOf(request);
  return sourceFile.statements.flatMap((statement) => {
    const own = statementImportOf({ node: statement, sourceFile });
    return own === undefined ? [] : [{ specifier: own.specifier, statement: statement.getText(sourceFile) }];
  });
};
