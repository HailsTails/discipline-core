import type { PieceHit, RunnerClause, WalkerPiece } from "@hailstails/hone/audit";

const SCRATCH_MARK = ".scratch.";

const scratchHits = (request: { readonly clauses: readonly RunnerClause[]; readonly file: string }): readonly PieceHit[] =>
  request.file.includes(SCRATCH_MARK)
    ? request.clauses.map((clause) => ({ clause: clause.address, anchor: { line: 1, column: 0 }, snippet: request.file }))
    : [];

export const check: WalkerPiece = {
  prepare: ({ clauses }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => ({ outcome: "ok", value: { kind: "complete", hits: scratchHits({ clauses, file }) } }),
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
