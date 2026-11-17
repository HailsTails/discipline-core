import type { PieceFailure } from "../../../core/mechanism-port/piece-failure-types.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-types.ts";
import { clauseAddressText } from "../../../core/values/clause-address.ts";
import { gatheredOutcomes } from "../../../core/values/gathered-outcomes.ts";
import type { Result } from "../../../core/values/result.ts";
import { stringListClauseSettings } from "../runner/piece-clause-settings.ts";
import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";
import { folderScope } from "../runner/source-scope.ts";

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
  return "eligible";
};

const BARE_TODO_PATTERN = /\/\/\s*TODO\b(?!\s*\()/;
const TS_EXPECT_ERROR_PATTERN = /\/\/\s*@ts-expect-error\b/;
const LINTER_DIRECTIVE_PATTERN =
  /^(?:\/\/|\/\*)\s*((?:biome-ignore(?:-all|-start|-end)?|(?:eslint|oxlint)-(?:disable(?:-line|-next-line)?|enable)|eslint(?=\s)))\b/;

type TrackedClause = {
  readonly clause: RunnerClause;
  readonly trackers: readonly RegExp[];
};

type Tracking = "tracked" | "untracked";

const compiledTracker = (request: {
  readonly clause: RunnerClause;
  readonly source: string;
}): Result<readonly RegExp[], PieceFailure> => {
  try {
    return { outcome: "ok", value: [new RegExp(request.source)] };
  } catch (thrown) {
    return {
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: request.clause.pieceRoot,
        detail: `the clauseSettings of ${clauseAddressText({ address: request.clause.address })} are malformed: trackerPatterns entry ${JSON.stringify(request.source)} is not a regular expression: ${thrown instanceof Error ? thrown.message : String(thrown)}`,
      },
    };
  }
};

const trackedClauseOf = (request: { readonly clause: RunnerClause }): Result<readonly TrackedClause[], PieceFailure> => {
  const settings = stringListClauseSettings({ clause: request.clause, keys: ["trackerPatterns"] });
  if (settings.outcome === "failed") return settings;
  const trackers = gatheredOutcomes({
    outcomes: settings.value.trackerPatterns.map((source) => compiledTracker({ clause: request.clause, source })),
  });
  if (trackers.outcome === "failed") return trackers;
  return { outcome: "ok", value: [{ clause: request.clause, trackers: trackers.value }] };
};

const trackedClausesOf = (request: {
  readonly clauses: readonly RunnerClause[];
}): Result<readonly TrackedClause[], PieceFailure> =>
  gatheredOutcomes({ outcomes: request.clauses.map((clause) => trackedClauseOf({ clause })) });

const trackingOf = (request: { readonly text: string; readonly tracked: TrackedClause }): Tracking =>
  request.tracked.trackers.some((tracker) => tracker.test(request.text)) ? "tracked" : "untracked";

const expectationTracking = (request: { readonly line: string; readonly tracked: TrackedClause }): Tracking | "no-expectation" => {
  const marker = TS_EXPECT_ERROR_PATTERN.exec(request.line);
  if (marker === null) return "no-expectation";
  return trackingOf({ text: request.line.slice(marker.index + marker[0].length), tracked: request.tracked });
};

export const check: WalkerPiece = {
  prepare: ({ clauses }) => {
    const settled = trackedClausesOf({ clauses });
    if (settled.outcome === "failed") return settled;
    const trackedClauses = settled.value;
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
                const todoHits: PieceHit[] = [];
                const directiveHits: PieceHit[] = [];
                const expectationHits: PieceHit[] = [];
                let linePosition = 0;
                sourceFile.text.split("\n").forEach((line) => {
                  const snippet = line.trim();
                  if (BARE_TODO_PATTERN.test(line)) {
                    const anchor = anchorAt({ position: linePosition });
                    todoHits.push(...clauses.map((clause) => ({ clause: clause.address, anchor, snippet })));
                  }
                  const untracked = trackedClauses.filter((tracked) => expectationTracking({ line, tracked }) === "untracked");
                  if (untracked.length > 0) {
                    const anchor = anchorAt({ position: linePosition });
                    expectationHits.push(...untracked.map((tracked) => ({ clause: tracked.clause.address, anchor, snippet })));
                  }
                  linePosition += line.length + 1;
                });
                return {
                  comment: ({ range }) => {
                    const comment = sourceFile.text.slice(range.pos, range.end);
                    if (LINTER_DIRECTIVE_PATTERN.exec(comment)?.[1] === undefined) return;
                    const untracked = trackedClauses.filter((tracked) => trackingOf({ text: comment, tracked }) === "untracked");
                    if (untracked.length === 0) return;
                    const anchor = anchorAt({ position: range.pos });
                    directiveHits.push(...untracked.map((tracked) => ({ clause: tracked.clause.address, anchor, snippet: comment.trim() })));
                  },
                  finish: () => [...todoHits, ...directiveHits, ...expectationHits],
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
