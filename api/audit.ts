import * as editionReach from "../core/values/edition-reach.ts";
import * as sourceScope from "../mechanisms/audit/runner/source-scope.ts";

export type { PieceFailure } from "../core/mechanism-port/piece-failure-types.ts";
export type { ClauseSettingValues, RunnerClause } from "../core/mechanism-port/runner-module-types.ts";
export type { ReadonlyJsonValue } from "../core/values/json-value.ts";
export type { Edition, EditionReach } from "../core/values/edition-types.ts";
export type { Hit } from "../core/mechanism-port/runner-result-types.ts";
export type { Anchor, AnchorKind } from "../core/values/anchor.ts";
export type { ClauseAddress, ToolRuleSet } from "../core/values/clause-address-types.ts";
export type { ClauseId, DisciplineId, RuleSetName } from "../core/values/identifier-types.ts";
export type { RepoPath } from "../core/values/repo-path-types.ts";
export type { Result } from "../core/values/result.ts";
export type { CommentRange, SyntaxApi, SyntaxNode, SyntaxTree } from "../mechanisms/audit/runner/typescript-parse.ts";
export type { PieceHit, PreparedFileCheck, PreparedWalkerCheck, SourceObservers, WalkerFile, WalkerPiece, WalkerRepository } from "../mechanisms/audit/runner/walker-piece.ts";

export const folderScope = sourceScope.folderScope;

export const editionReaches = editionReach.editionReaches;
