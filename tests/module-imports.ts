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

const loadsAModule = (request: { readonly callee: SyntaxNode }): boolean =>
  request.callee.kind === syntaxApi.SyntaxKind.ImportKeyword || (syntaxApi.isIdentifier(request.callee) && request.callee.text === "require");

const ownImportOf = (request: NodeIn): ModuleImport | undefined => {
  const { node, sourceFile } = request;
  if (syntaxApi.isImportDeclaration(node)) {
    return { specifier: specifierOf({ expression: node.moduleSpecifier, sourceFile }), form: node.importClause?.isTypeOnly === true ? "type-only" : "value" };
  }
  if (syntaxApi.isExportDeclaration(node)) {
    return node.moduleSpecifier === undefined
      ? undefined
      : { specifier: specifierOf({ expression: node.moduleSpecifier, sourceFile }), form: node.isTypeOnly ? "type-only" : "value" };
  }
  if (syntaxApi.isImportEqualsDeclaration(node)) {
    return syntaxApi.isExternalModuleReference(node.moduleReference)
      ? { specifier: specifierOf({ expression: node.moduleReference.expression, sourceFile }), form: node.isTypeOnly ? "type-only" : "value" }
      : undefined;
  }
  if (syntaxApi.isImportTypeNode(node)) {
    return {
      specifier: specifierOf({ expression: syntaxApi.isLiteralTypeNode(node.argument) ? node.argument.literal : node.argument, sourceFile }),
      form: "type-only",
    };
  }
  if (syntaxApi.isCallExpression(node) && loadsAModule({ callee: node.expression })) {
    const [loaded] = node.arguments;
    return loaded === undefined ? undefined : { specifier: specifierOf({ expression: loaded, sourceFile }), form: "dynamic" };
  }
  return undefined;
};

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

const namesItsSource = (request: { readonly statement: SyntaxNode }): boolean =>
  (syntaxApi.isImportDeclaration(request.statement) && request.statement.importClause !== undefined) ||
  (syntaxApi.isExportDeclaration(request.statement) && request.statement.moduleSpecifier !== undefined);

export type ImportStatementIn = { readonly specifier: string; readonly statement: string };

export const importStatementsIn = (request: SourceText): readonly ImportStatementIn[] => {
  const sourceFile = sourceFileOf(request);
  return sourceFile.statements
    .filter((statement) => namesItsSource({ statement }))
    .flatMap((statement) => {
      const own = ownImportOf({ node: statement, sourceFile });
      return own === undefined ? [] : [{ specifier: own.specifier, statement: statement.getText(sourceFile) }];
    });
};
