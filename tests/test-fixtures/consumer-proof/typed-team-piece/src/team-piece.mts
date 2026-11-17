import type { PieceFailure, PieceHit, WalkerPiece } from "@hailstails/hone/audit";

const settingsRefused = (request: { readonly pieceRoot: string }): PieceFailure => ({ kind: "piece-invalid", pieceRoot: request.pieceRoot, detail: "settings must be an empty object" });

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => {
    const unsettled = clauses.find((clause) => typeof clause.settings !== "object");
    if (unsettled !== undefined) return { outcome: "failed", error: settingsRefused({ pieceRoot: unsettled.pieceRoot }) };
    return {
      outcome: "ok",
      value: {
        prepareFile: ({ readText }) => {
          const text = readText();
          if (text.outcome === "failed") return text;
          return {
            outcome: "ok",
            value: {
              kind: "syntax",
              begin: ({ sourceFile, anchorAt }) => {
                const hits: PieceHit[] = [];
                return {
                  enter: ({ node }) => {
                    if (!syntaxApi.isDebuggerStatement(node)) return;
                    const anchor = anchorAt({ position: node.getStart(sourceFile) });
                    hits.push(...clauses.map((clause) => ({ clause: clause.address, anchor, snippet: node.getText(sourceFile) })));
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
