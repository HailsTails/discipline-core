import { describe, expect, it } from "vitest";
import { declarationReachOf } from "./declaration-graph.ts";

const AUTHORING_AUDIT_PROBE = `export type { PieceHit, PreparedFileCheck, PreparedWalkerCheck, SourceObservers, WalkerFile, WalkerPiece, WalkerRepository } from "./mechanisms/audit/runner/walker-piece.ts";
export type { CommentRange, SyntaxApi, SyntaxNode, SyntaxTree } from "./mechanisms/audit/runner/typescript-parse.ts";
export type { RunnerClause } from "./core/mechanism-port/runner-module-types.ts";
export type { PeerKind, RunnerFailure } from "./core/mechanism-port/runner-failure.ts";
export type { Hit } from "./core/mechanism-port/runner-result-types.ts";
export type { ClauseAddress, ToolRuleSet } from "./core/values/clause-address-types.ts";
export type { ClauseId, DisciplineId, MechanismId, RuleSetName } from "./core/values/identifier-types.ts";
export type { Anchor, AnchorKind } from "./core/values/anchor.ts";
export type { RepoPath } from "./core/values/repo-path-types.ts";
export type { Result } from "./core/values/result.ts";
`;

const AUTHORING_RULE_SET_PROBE = `export type { ClauseDefinition, ClauseExceptions, DisciplineFile, PieceFile, SourceCase } from "./core/rule-set-reader/rule-set-types.ts";
export type { EslintPieceSettings, RuleOptions } from "./mechanisms/eslint/runner/eslint-piece-settings-types.ts";
export type { JsonValue } from "./core/values/json-value.ts";
`;

const auditReach = declarationReachOf({ probeSource: AUTHORING_AUDIT_PROBE });

const ruleSetReach = declarationReachOf({ probeSource: AUTHORING_RULE_SET_PROBE });

describe("declarations reachable from the planned public authoring types, emitted in memory with the repository's own TypeScript (CD-47: nothing is spawned or written)", () => {
  it("emit the audit authoring types with no diagnostic and every reached declaration emitted", () => {
    expect({ diagnostics: auditReach.diagnostics, unemitted: auditReach.unemitted }).toEqual({ diagnostics: [], unemitted: [] });
  });

  it("import no package but typescript for the audit authoring types", () => {
    expect(auditReach.packageImports).toEqual(["typescript"]);
  });

  it("reach no internal port, toolchain or tool identity from the audit authoring types", () => {
    expect(auditReach.reached).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^core\/(?:mechanism-port\/toolchain-requirement|platform-ports\/package-location-port|values\/install-layout|values\/tool-identity)\.d\.ts$/,
        ),
      ]),
    );
  });

  it("emit the rule-set authoring types with no diagnostic and every reached declaration emitted", () => {
    expect({ diagnostics: ruleSetReach.diagnostics, unemitted: ruleSetReach.unemitted }).toEqual({ diagnostics: [], unemitted: [] });
  });

  it("import no package at all for the rule-set authoring types", () => {
    expect(ruleSetReach.packageImports).toEqual([]);
  });
});
