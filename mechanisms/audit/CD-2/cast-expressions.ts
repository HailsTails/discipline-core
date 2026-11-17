import { castJudgeFor, permittedCastsOf } from "../runner/cast-permission.ts";
import type { SyntaxTree } from "../runner/typescript-parse.ts";
import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";
import { folderScope } from "../runner/source-scope.ts";

const SNIPPET_MAX_LENGTH = 80;
const CD1_ANY_PATTERN = /\bas\s+any\b|:\s*any\b|<any>/;

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
  return "eligible";
};

const snippetAt = (request: {
  readonly sourceFile: SyntaxTree;
  readonly position: number;
}): string => {
  const snippet = request.sourceFile.text
    .slice(request.position, request.position + SNIPPET_MAX_LENGTH)
    .replace(/\n/g, " ");
  return snippet.length === SNIPPET_MAX_LENGTH ? `${snippet}…` : snippet;
};

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => {
    const settled = permittedCastsOf({ clauses });
    if (settled.outcome === "failed") return settled;
    const permittedByClause = settled.value;
    return {
      outcome: "ok",
      value: {
        prepareFile: ({ file }) => {
          if (sourceEligibility({ file }) === "excluded") {
            return { outcome: "ok", value: { kind: "skipped" } };
          }
          return {
            outcome: "ok",
            value: {
              kind: "syntax",
              begin: ({ sourceFile, anchorAt }) => {
                const judges = permittedByClause.map((permitted) => ({
                  clause: permitted.clause,
                  judge: castJudgeFor({ permitted, sourceFile, syntaxApi }),
                }));
                const hits: PieceHit[] = [];
                return {
                  enter: ({ node }) => {
                    if (!syntaxApi.isAsExpression(node) && !syntaxApi.isTypeAssertionExpression(node)) return;
                    const position = node.getStart(sourceFile);
                    const snippet = snippetAt({ sourceFile, position });
                    if (CD1_ANY_PATTERN.test(snippet)) return;
                    const forbidding = judges.filter(({ judge }) => judge({ node }) === "forbidden");
                    if (forbidding.length === 0) return;
                    const anchor = anchorAt({ position });
                    hits.push(...forbidding.map(({ clause }) => ({ clause: clause.address, anchor, snippet })));
                  },
                  finish: () => hits,
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
