import type { SyntaxApi, SyntaxNode, SyntaxTree } from "./typescript-parse.ts";

export type Assertion = {
  readonly node: SyntaxNode;
  readonly expression: SyntaxNode;
  readonly type: SyntaxNode;
  readonly form: "as" | "angle-bracket";
};

export type AnyBearing = "any-bearing" | "any-free";

export type CastShape = "const-assertion" | "unknown-widening" | "through-unknown" | "type-assertion";

const SNIPPET_MAX_LENGTH = 80;

export const castSnippetAt = (request: { readonly sourceFile: SyntaxTree; readonly position: number }): string => {
  const snippet = request.sourceFile.text
    .slice(request.position, request.position + SNIPPET_MAX_LENGTH)
    .replace(/\n/g, " ");
  return snippet.length === SNIPPET_MAX_LENGTH ? `${snippet}…` : snippet;
};

export const assertionOf = (request: { readonly node: SyntaxNode; readonly syntaxApi: SyntaxApi }): Assertion | undefined => {
  const { node, syntaxApi } = request;
  if (syntaxApi.isAsExpression(node)) return { node, expression: node.expression, type: node.type, form: "as" };
  if (syntaxApi.isTypeAssertionExpression(node)) return { node, expression: node.expression, type: node.type, form: "angle-bracket" };
  return undefined;
};

const anyBearingFound = (request: { readonly typeNode: SyntaxNode; readonly syntaxApi: SyntaxApi }): "any-bearing" | undefined =>
  anyBearingOf(request) === "any-bearing" ? "any-bearing" : undefined;

export const anyBearingOf = (request: { readonly typeNode: SyntaxNode; readonly syntaxApi: SyntaxApi }): AnyBearing => {
  const { typeNode, syntaxApi } = request;
  if (typeNode.kind === syntaxApi.SyntaxKind.AnyKeyword) return "any-bearing";
  return syntaxApi.forEachChild(typeNode, (child) => anyBearingFound({ typeNode: child, syntaxApi })) ?? "any-free";
};

const unwrappedExpression = (request: { readonly node: SyntaxNode; readonly syntaxApi: SyntaxApi }): SyntaxNode =>
  request.syntaxApi.isParenthesizedExpression(request.node)
    ? unwrappedExpression({ node: request.node.expression, syntaxApi: request.syntaxApi })
    : request.node;

const unknownTypeOf = (request: { readonly typeNode: SyntaxNode; readonly syntaxApi: SyntaxApi }): "unknown" | "other" =>
  request.typeNode.kind === request.syntaxApi.SyntaxKind.UnknownKeyword ? "unknown" : "other";

const constTypeOf = (request: { readonly typeNode: SyntaxNode; readonly syntaxApi: SyntaxApi }): "const" | "other" => {
  const { typeNode, syntaxApi } = request;
  if (!syntaxApi.isTypeReferenceNode(typeNode) || !syntaxApi.isIdentifier(typeNode.typeName)) return "other";
  return typeNode.typeName.text === "const" ? "const" : "other";
};

export const castShapeOf = (request: { readonly assertion: Assertion; readonly syntaxApi: SyntaxApi }): CastShape => {
  const { assertion, syntaxApi } = request;
  const operand = assertionOf({ node: unwrappedExpression({ node: assertion.expression, syntaxApi }), syntaxApi });
  if (operand !== undefined && unknownTypeOf({ typeNode: operand.type, syntaxApi }) === "unknown") return "through-unknown";
  if (unknownTypeOf({ typeNode: assertion.type, syntaxApi }) === "unknown") return "unknown-widening";
  if (constTypeOf({ typeNode: assertion.type, syntaxApi }) === "const") return "const-assertion";
  return "type-assertion";
};
