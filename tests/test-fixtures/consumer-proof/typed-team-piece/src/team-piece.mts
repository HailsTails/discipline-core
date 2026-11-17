import type { PieceHit, WalkerPiece } from "@hailstails/hone/audit";
import type { PieceFile } from "@hailstails/hone/rule-set";

export type TeamPieceFile = PieceFile;

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: () => ({
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
      }),
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
