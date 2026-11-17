import type { PieceFailure, PieceHit, RunnerClause, WalkerPiece } from "@hailstails/hone/audit";

type MarkedClause = { readonly clause: RunnerClause; readonly marker: string };

const markedClauses = (request: { readonly clauses: readonly RunnerClause[] }): readonly MarkedClause[] =>
  request.clauses.flatMap((clause) => {
    const marker = clause.clauseSettings.marker;
    return typeof marker === "string" ? [{ clause, marker }] : [];
  });

const markerRefused = (request: { readonly clause: RunnerClause }): PieceFailure => ({
  kind: "piece-invalid",
  pieceRoot: request.clause.pieceRoot,
  detail: "the marker setting must be a string",
});

const scratchHits = (request: { readonly marked: readonly MarkedClause[]; readonly file: string }): readonly PieceHit[] =>
  request.marked
    .filter((entry) => request.file.includes(entry.marker))
    .map((entry) => ({ clause: entry.clause.address, anchor: { line: 1, column: 0 }, snippet: request.file }));

export const check: WalkerPiece = {
  prepare: ({ clauses }) => {
    const unmarked = clauses.find((clause) => typeof clause.clauseSettings.marker !== "string");
    if (unmarked !== undefined) {
      return { outcome: "failed", error: markerRefused({ clause: unmarked }) };
    }
    const marked = markedClauses({ clauses });
    return {
      outcome: "ok",
      value: {
        prepareFile: ({ file }) => ({ outcome: "ok", value: { kind: "complete", hits: scratchHits({ marked, file }) } }),
        finish: () => ({ outcome: "ok", value: [] }),
      },
    };
  },
};
