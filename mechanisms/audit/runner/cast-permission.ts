import type { PieceFailure } from "../../../core/mechanism-port/piece-failure-types.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-types.ts";
import { gatheredOutcomes } from "../../../core/values/gathered-outcomes.ts";
import type { Result } from "../../../core/values/result.ts";
import { stringListClauseSettings } from "./piece-clause-settings.ts";
import type { SyntaxApi, SyntaxNode, SyntaxTree } from "./typescript-parse.ts";

export type CastPermission = "permitted" | "forbidden";

export type PermittedCasts = {
  readonly clause: RunnerClause;
  readonly typeNames: ReadonlySet<string>;
  readonly typePackages: readonly string[];
};

export type CastJudge = (request: { readonly node: SyntaxNode }) => CastPermission;

const permittedCastsOfClause = (request: { readonly clause: RunnerClause }): Result<readonly PermittedCasts[], PieceFailure> => {
  const settings = stringListClauseSettings({
    clause: request.clause,
    keys: ["permittedCastTypes", "permittedCastTypePackages"],
  });
  if (settings.outcome === "failed") return settings;
  return {
    outcome: "ok",
    value: [{
      clause: request.clause,
      typeNames: new Set(settings.value.permittedCastTypes),
      typePackages: settings.value.permittedCastTypePackages,
    }],
  };
};

export const permittedCastsOf = (request: {
  readonly clauses: readonly RunnerClause[];
}): Result<readonly PermittedCasts[], PieceFailure> =>
  gatheredOutcomes({ outcomes: request.clauses.map((clause) => permittedCastsOfClause({ clause })) });

const withinPackage = (request: { readonly specifier: string; readonly packageName: string }): "inside" | "outside" =>
  request.specifier === request.packageName || request.specifier.startsWith(`${request.packageName}/`) ? "inside" : "outside";

const namesImportedFromPackages = (request: {
  readonly sourceFile: SyntaxTree;
  readonly syntaxApi: SyntaxApi;
  readonly typePackages: readonly string[];
}): ReadonlySet<string> => new Set(
  request.sourceFile.statements.flatMap((statement) => {
    if (!request.syntaxApi.isImportDeclaration(statement)) return [];
    if (!request.syntaxApi.isStringLiteral(statement.moduleSpecifier)) return [];
    const specifier = statement.moduleSpecifier.text;
    if (!request.typePackages.some((packageName) => withinPackage({ specifier, packageName }) === "inside")) return [];
    const namedBindings = statement.importClause?.namedBindings;
    if (namedBindings === undefined || !request.syntaxApi.isNamedImports(namedBindings)) return [];
    return namedBindings.elements.map((element) => element.name.text);
  }),
);

const castTypeName = (request: {
  readonly typeNode: SyntaxNode;
  readonly sourceFile: SyntaxTree;
  readonly syntaxApi: SyntaxApi;
}): string | undefined => {
  if (request.syntaxApi.isTypeReferenceNode(request.typeNode)) return request.typeNode.typeName.getText(request.sourceFile);
  if (!request.syntaxApi.isIndexedAccessTypeNode(request.typeNode)) return undefined;
  const { objectType, indexType } = request.typeNode;
  if (!request.syntaxApi.isTypeReferenceNode(objectType)) return undefined;
  if (!request.syntaxApi.isLiteralTypeNode(indexType) || !request.syntaxApi.isStringLiteral(indexType.literal)) return undefined;
  return `${objectType.typeName.getText(request.sourceFile)}[${JSON.stringify(indexType.literal.text)}]`;
};

export const castJudgeFor = (request: {
  readonly permitted: PermittedCasts;
  readonly sourceFile: SyntaxTree;
  readonly syntaxApi: SyntaxApi;
}): CastJudge => {
  const { permitted, sourceFile, syntaxApi } = request;
  const importedTypeNames = namesImportedFromPackages({ sourceFile, syntaxApi, typePackages: permitted.typePackages });
  return ({ node }) => {
    if (!syntaxApi.isAsExpression(node)) return "forbidden";
    if (node.type.kind === syntaxApi.SyntaxKind.UnknownKeyword) return "permitted";
    const typeName = castTypeName({ typeNode: node.type, sourceFile, syntaxApi });
    if (typeName === undefined) return "forbidden";
    if (typeName === "const" || permitted.typeNames.has(typeName)) return "permitted";
    if (syntaxApi.isTypeReferenceNode(node.type) && importedTypeNames.has(typeName)) return "permitted";
    return "forbidden";
  };
};
