import type { PieceFailure } from "../../../core/mechanism-port/piece-failure-types.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-types.ts";
import type { Result } from "../../../core/values/result.ts";
import type { SyntaxNode } from "../runner/typescript-parse.ts";
import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";
import { folderScope } from "../runner/source-scope.ts";
import { gatheredOutcomes } from "../../../core/values/gathered-outcomes.ts";
import { stringListClauseSettings } from "../runner/piece-clause-settings.ts";

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
  return "eligible";
};

type ConfinedPattern = { readonly pattern: RegExp };

type ConfinedClause = {
  readonly clause: RunnerClause;
  readonly anywhere: RegExp | undefined;
  readonly patterns: readonly ConfinedPattern[];
};

const escapedPackage = (request: { readonly packageName: string }): string =>
  request.packageName.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const confinedImportPattern = (request: { readonly packageNames: readonly string[] }): RegExp =>
  new RegExp(
    `from\\s+["']((?:${request.packageNames.map((packageName) => escapedPackage({ packageName })).join("|")})(?:/[^"']*)?)["']`,
  );

const confinedClauseOf = (request: {
  readonly clause: RunnerClause;
  readonly packageNames: readonly string[];
}): ConfinedClause => ({
  clause: request.clause,
  anywhere: request.packageNames.length === 0 ? undefined : confinedImportPattern({ packageNames: request.packageNames }),
  patterns: request.packageNames.map((packageName) => ({ pattern: confinedImportPattern({ packageNames: [packageName] }) })),
});

const confinedImportsIn = (request: {
  readonly text: string;
  readonly confined: ConfinedClause;
}): readonly { readonly line: number; readonly specifier: string }[] => {
  if (request.confined.anywhere === undefined || !request.confined.anywhere.test(request.text)) return [];
  return request.text.split("\n").flatMap((text, index) =>
    request.confined.patterns.flatMap(({ pattern }) => {
      const specifier = pattern.exec(text)?.[1];
      return specifier === undefined ? [] : [{ line: index + 1, specifier }];
    }),
  );
};

const confinedImportHits = (request: {
  readonly text: string;
  readonly confined: readonly ConfinedClause[];
}): readonly PieceHit[] =>
  request.confined.flatMap((confined) =>
    confinedImportsIn({ text: request.text, confined }).map(({ line, specifier }) => ({
      clause: confined.clause.address,
      anchor: { line, column: 0 },
      snippet: `banned third-party import: ${specifier} — use its recorded wrapping boundary`,
    })),
  );

const confinedClausesOf = (request: {
  readonly clauses: readonly RunnerClause[];
}): Result<readonly ConfinedClause[], PieceFailure> =>
  gatheredOutcomes({
    outcomes: request.clauses.map((clause): Result<readonly ConfinedClause[], PieceFailure> => {
      const settings = stringListClauseSettings({ clause, keys: ["confinedPackages"] });
      if (settings.outcome === "failed") return settings;
      return { outcome: "ok", value: [confinedClauseOf({ clause, packageNames: settings.value.confinedPackages })] };
    }),
  });

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => {
    const settled = confinedClausesOf({ clauses });
    if (settled.outcome === "failed") return settled;
    const confined = settled.value;
    return {
      outcome: "ok",
      value: {
        prepareFile: ({ file }) => {
          if (sourceEligibility({ file }) === "excluded") return { outcome: "ok", value: { kind: "skipped" } };
          return {
            outcome: "ok",
            value: {
              kind: "syntax",
              begin: ({ sourceFile, anchorAt }) => {
                const rawHits = confinedImportHits({ text: sourceFile.text, confined });
                const nodeHits: PieceHit[] = [];
                const record = (specifier: SyntaxNode | undefined): void => {
                  if (specifier === undefined || !syntaxApi.isStringLiteralLike(specifier) || !specifier.text.startsWith("node:")) return;
                  const anchor = anchorAt({ position: specifier.getStart(sourceFile) });
                  const snippet = `bare node: stdlib import - use the kernel port package: ${specifier.text}`;
                  nodeHits.push(...clauses.map((clause) => ({ clause: clause.address, anchor, snippet })));
                };
                return {
                  enter: ({ node }) => {
                    if (syntaxApi.isImportDeclaration(node) || syntaxApi.isExportDeclaration(node)) {
                      record(node.moduleSpecifier);
                    } else if (syntaxApi.isImportTypeNode(node) && syntaxApi.isLiteralTypeNode(node.argument)) {
                      record(node.argument.literal);
                    } else if (syntaxApi.isImportEqualsDeclaration(node) && syntaxApi.isExternalModuleReference(node.moduleReference)) {
                      record(node.moduleReference.expression);
                    } else if (syntaxApi.isCallExpression(node) && (node.expression.kind === syntaxApi.SyntaxKind.ImportKeyword ||
                      (syntaxApi.isIdentifier(node.expression) && node.expression.text === "require"))) {
                      record(node.arguments[0]);
                    }
                  },
                  finish: () => [...rawHits, ...nodeHits],
                };
              },
            },
          };
        },
        finish: () => ({ outcome: "ok", value: [] }),
      },
    };
  },
};
