import type { SyntaxNode } from "../runner/typescript-parse.ts";
import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";
import { folderScope } from "../runner/source-scope.ts";

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
  return "eligible";
};

const BANNED_THIRD_PARTY_IMPORTS: readonly string[] = [
  "eslint", "winston", "winston-transport", "better-sqlite3", "pino", "hono", "@hono/node-server",
  "hono/cors", "hono/cookie", "hono/types", "hono/utils/http-status", "jose", "@modelcontextprotocol/sdk",
  "zod-to-json-schema", "uuid",
];

const escapedSpecifier = (request: { readonly specifier: string }): string =>
  request.specifier.replace(/[/.]/g, "\\$&");

const bannedImportPattern = (request: { readonly specifiers: readonly string[] }): RegExp =>
  new RegExp(`from\\s+["'](?:${request.specifiers.map((specifier) => escapedSpecifier({ specifier })).join("|")})["']`);

const BANNED_IMPORT_ANYWHERE = bannedImportPattern({ specifiers: BANNED_THIRD_PARTY_IMPORTS });

const BANNED_IMPORT_PATTERNS: readonly { readonly specifier: string; readonly pattern: RegExp }[] =
  BANNED_THIRD_PARTY_IMPORTS.map((specifier) => ({ specifier, pattern: bannedImportPattern({ specifiers: [specifier] }) }));

const bannedImportsIn = (request: { readonly text: string }): readonly { readonly line: number; readonly specifier: string }[] => {
  if (!BANNED_IMPORT_ANYWHERE.test(request.text)) return [];
  return request.text.split("\n").flatMap((text, index) =>
    BANNED_IMPORT_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ specifier }) => ({ line: index + 1, specifier })),
  );
};

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (sourceEligibility({ file }) === "excluded") return { outcome: "ok", value: { kind: "skipped" } };
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const rawHits = bannedImportsIn({ text: sourceFile.text }).flatMap(({ line, specifier }) =>
                clauses.map((clause) => ({
                  clause: clause.address,
                  anchor: { line, column: 0 },
                  snippet: `banned third-party import: ${specifier} — use its recorded wrapping boundary`,
                })),
              );
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
  }),
};
