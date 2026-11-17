import { describe, expect, it, vi } from "vitest";
import { createDefaultGitPort, type GitPort } from "../core/platform-ports/git-port.ts";
import { type RepoPath, repoPathSchema } from "../core/values/repo-path.ts";
import { ESLINT_LINES } from "./eslint-toolchains.ts";
import {
  fixtureSubject,
  honeTreeSubject,
  monorepoSubject,
  type ProofPartition,
  type ScopeSetProof,
  scopeSetProof,
} from "./scope-set-proof.ts";

const gitTracking = (request: { readonly tracked: readonly string[] }): GitPort => ({
  trackedPaths: vi
    .fn<GitPort["trackedPaths"]>()
    .mockReturnValue({ outcome: "ok", value: repoPathSchema.array().parse(request.tracked) }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
});

const MONOREPO_TRACKED: readonly string[] = ["packages/a/x.ts", "package.json"];

const VERDICT_LINE = "verdict: ";

const NO_GOVERNANCE_LINT: ProofPartition = "no-governance-lint";

const EVERY_FILE_IN_SCOPE = expect.objectContaining({ rest: [] });

const provenOf = (request: { readonly proof: ScopeSetProof }) => ({
  fullReport: request.proof.fullReport,
  scopedReport: request.proof.scopedReport,
  importedPiecesReport: request.proof.importedPiecesReport,
  partition: request.proof.partition,
  restTeamLint: request.proof.restTeamLint,
});

const identityWith = (request: { readonly proof: ScopeSetProof; readonly partition: unknown }) => ({
  fullReport: expect.stringContaining(VERDICT_LINE),
  scopedReport: request.proof.fullReport,
  importedPiecesReport: request.proof.fullReport,
  partition: request.partition,
  restTeamLint: request.proof.restGovernanceLint,
});

const FIXTURES = [
  {
    fixture: "override-after",
    tracked: ["x.ts"],
    asConfigured: EVERY_FILE_IN_SCOPE,
    typescriptParserBlock: { scopeSet: [{ file: "x.ts", reasons: ["rule-differs"] }], rest: [] },
  },
  {
    fixture: "global-ignore",
    tracked: ["gen/g.ts", "src/clean.ts"],
    asConfigured: EVERY_FILE_IN_SCOPE,
    typescriptParserBlock: { scopeSet: [{ file: "gen/g.ts", reasons: ["ignored"] }], rest: ["src/clean.ts"] },
  },
  {
    fixture: "severity-zero",
    tracked: ["x.ts"],
    asConfigured: EVERY_FILE_IN_SCOPE,
    typescriptParserBlock: { scopeSet: [{ file: "x.ts", reasons: ["rule-differs"] }], rest: [] },
  },
  {
    fixture: "re-enabled-record",
    tracked: ["src/owned.ts"],
    asConfigured: NO_GOVERNANCE_LINT,
    typescriptParserBlock: NO_GOVERNANCE_LINT,
  },
  {
    fixture: "suppression-default",
    tracked: ["supp/a.ts", "eslint-suppressions.json"],
    asConfigured: EVERY_FILE_IN_SCOPE,
    typescriptParserBlock: { scopeSet: [{ file: "supp/a.ts", reasons: ["suppression-entry"] }], rest: [] },
  },
  {
    fixture: "suppression-scripted",
    tracked: ["supp/b.ts", "supp/clean.ts", "package.json", "custom/supp.json", "custom/supp2.json"],
    asConfigured: EVERY_FILE_IN_SCOPE,
    typescriptParserBlock: {
      scopeSet: [
        { file: "supp/b.ts", reasons: ["suppression-entry"] },
        { file: "supp/clean.ts", reasons: ["suppression-entry"] },
      ],
      rest: [],
    },
  },
  {
    fixture: "suppression-nested",
    tracked: ["packages/a/src/n.ts", "packages/a/eslint-suppressions.json"],
    asConfigured: EVERY_FILE_IN_SCOPE,
    typescriptParserBlock: {
      scopeSet: [{ file: "packages/a/src/n.ts", reasons: ["suppression-entry"] }],
      rest: [],
    },
  },
  {
    fixture: "command-line-options",
    tracked: ["src/plain.ts", "package.json"],
    asConfigured: EVERY_FILE_IN_SCOPE,
    typescriptParserBlock: { scopeSet: [{ file: "src/plain.ts", reasons: ["command-line-option"] }], rest: [] },
  },
  {
    fixture: "inline-forms",
    tracked: [
      "i/disable-file.ts",
      "i/disable-file-named.ts",
      "i/disable-line.ts",
      "i/disable-next-line.ts",
      "i/rule-config.ts",
      "i/other-rule.ts",
      "i/enable.ts",
      "i/global.ts",
    ],
    asConfigured: EVERY_FILE_IN_SCOPE,
    typescriptParserBlock: {
      scopeSet: [
        { file: "i/disable-file.ts", reasons: ["directive-text"] },
        { file: "i/disable-file-named.ts", reasons: ["directive-text"] },
        { file: "i/disable-line.ts", reasons: ["directive-text"] },
        { file: "i/disable-next-line.ts", reasons: ["directive-text"] },
        { file: "i/rule-config.ts", reasons: ["directive-text"] },
        { file: "i/other-rule.ts", reasons: ["directive-text"] },
        { file: "i/enable.ts", reasons: ["directive-text"] },
        { file: "i/global.ts", reasons: ["directive-text"] },
      ],
      rest: [],
    },
  },
  {
    fixture: "route-brackets",
    tracked: ["route/[id].ts", "route/i.ts"],
    asConfigured: EVERY_FILE_IN_SCOPE,
    typescriptParserBlock: {
      scopeSet: [{ file: "route/[id].ts", reasons: ["rule-differs"] }],
      rest: ["route/i.ts"],
    },
  },
  {
    fixture: "projection-missing",
    tracked: ["x.ts"],
    asConfigured: NO_GOVERNANCE_LINT,
    typescriptParserBlock: NO_GOVERNANCE_LINT,
  },
  {
    fixture: "projection-hand-edited",
    tracked: ["x.ts"],
    asConfigured: EVERY_FILE_IN_SCOPE,
    typescriptParserBlock: { scopeSet: [], rest: ["x.ts"] },
  },
  {
    fixture: "projection-not-imported",
    tracked: ["x.ts"],
    asConfigured: NO_GOVERNANCE_LINT,
    typescriptParserBlock: NO_GOVERNANCE_LINT,
  },
  {
    fixture: "fragment-not-projection",
    tracked: ["src/owned.ts", "src/clean.ts"],
    asConfigured: NO_GOVERNANCE_LINT,
    typescriptParserBlock: NO_GOVERNANCE_LINT,
  },
  {
    fixture: "fr3-anchors",
    tracked: [
      "src/decl.ts",
      "src/expr.ts",
      "src/default.ts",
      "src/abstract.ts",
      "src/nested.ts",
      "src/space.ts",
      "src/anon.ts",
    ],
    asConfigured: EVERY_FILE_IN_SCOPE,
    typescriptParserBlock: {
      scopeSet: [],
      rest: [
        "src/decl.ts",
        "src/expr.ts",
        "src/default.ts",
        "src/abstract.ts",
        "src/nested.ts",
        "src/space.ts",
        "src/anon.ts",
      ],
    },
  },
];

describe.each(ESLINT_LINES)("the scope set on %s, over every consumer repository the native-exceptions suite checks", (line) => {
  it.each(FIXTURES)(
    "$fixture as configured: linting only the scope set, with the team's own run for the rest, gives the full report byte for byte",
    async ({ fixture, tracked, asConfigured }) => {
      const proof = await scopeSetProof(
        fixtureSubject({ line, teamParser: "as-configured", fixture, git: gitTracking({ tracked }) }),
      );
      expect(provenOf({ proof })).toEqual(identityWith({ proof, partition: asConfigured }));
    },
  );

  it.each(FIXTURES)(
    "$fixture with the TypeScript parser in the team's configuration: linting only the scope set, with the team's own run for the rest, gives the full report byte for byte",
    async ({ fixture, tracked, typescriptParserBlock }) => {
      const proof = await scopeSetProof(
        fixtureSubject({ line, teamParser: "typescript-parser-block", fixture, git: gitTracking({ tracked }) }),
      );
      expect(provenOf({ proof })).toEqual(identityWith({ proof, partition: typescriptParserBlock }));
    },
  );
});

const PACKAGE_FILE_IN_REST = { scopeSet: [], rest: ["packages/a/x.ts"] };

const PACKAGE_FILE_PARSED_BY_DEFAULT = {
  scopeSet: [{ file: "packages/a/x.ts", reasons: ["parser-differs"] }],
  rest: [],
};

const MONOREPOS = [
  {
    fixture: "monorepo-package-config",
    version: "10.11.0",
    lintCommand: "eslint .",
    asConfigured: PACKAGE_FILE_PARSED_BY_DEFAULT,
    typescriptParserBlock: PACKAGE_FILE_IN_REST,
  },
  {
    fixture: "monorepo-package-config",
    version: "9.39.5",
    lintCommand: "eslint --flag v10_config_lookup_from_file .",
    asConfigured: PACKAGE_FILE_PARSED_BY_DEFAULT,
    typescriptParserBlock: PACKAGE_FILE_IN_REST,
  },
  {
    fixture: "monorepo-package-config",
    version: "9.39.5",
    lintCommand: "eslint .",
    asConfigured: NO_GOVERNANCE_LINT,
    typescriptParserBlock: NO_GOVERNANCE_LINT,
  },
  {
    fixture: "monorepo-root-config",
    version: "10.11.0",
    lintCommand: "eslint .",
    asConfigured: NO_GOVERNANCE_LINT,
    typescriptParserBlock: NO_GOVERNANCE_LINT,
  },
  {
    fixture: "monorepo-root-config",
    version: "9.39.5",
    lintCommand: "eslint --flag v10_config_lookup_from_file .",
    asConfigured: NO_GOVERNANCE_LINT,
    typescriptParserBlock: NO_GOVERNANCE_LINT,
  },
  {
    fixture: "monorepo-root-config",
    version: "9.39.5",
    lintCommand: "eslint .",
    asConfigured: PACKAGE_FILE_PARSED_BY_DEFAULT,
    typescriptParserBlock: PACKAGE_FILE_IN_REST,
  },
];

describe.each(ESLINT_LINES)("the scope set on %s, over the monorepos the native-exceptions suite checks", (line) => {
  it.each(MONOREPOS)(
    "$fixture under ESLint $version running `$lintCommand`, as configured and with the TypeScript parser in the team's configuration, gives the full report byte for byte",
    async ({ fixture, version, lintCommand, asConfigured, typescriptParserBlock }) => {
      const asConfiguredProof = await scopeSetProof(
        monorepoSubject({
          line,
          teamParser: "as-configured",
          fixture,
          eslintVersion: version,
          lintCommand,
          git: gitTracking({ tracked: MONOREPO_TRACKED }),
        }),
      );
      const typescriptParserProof = await scopeSetProof(
        monorepoSubject({
          line,
          teamParser: "typescript-parser-block",
          fixture,
          eslintVersion: version,
          lintCommand,
          git: gitTracking({ tracked: MONOREPO_TRACKED }),
        }),
      );
      expect([provenOf({ proof: asConfiguredProof }), provenOf({ proof: typescriptParserProof })]).toEqual([
        identityWith({ proof: asConfiguredProof, partition: asConfigured }),
        identityWith({ proof: typescriptParserProof, partition: typescriptParserBlock }),
      ]);
    },
  );
});

const HONE_TREE_TIMEOUT = 120_000;

const FILE_WITH_NO_DIRECTIVE: RepoPath = repoPathSchema.parse("core/check/run-check.ts");

describe("the scope set on eslint-10 over Hone's own tracked tree", () => {
  it("puts every file in the scope set as configured, because Hone's own ESLint configuration leaves TypeScript files to ESLint's default parser, and the report is unchanged", async () => {
    const proof = await scopeSetProof(
      honeTreeSubject({ line: "eslint-10", teamParser: "as-configured", git: createDefaultGitPort({}) }),
    );
    expect(provenOf({ proof })).toEqual(identityWith({ proof, partition: EVERY_FILE_IN_SCOPE }));
  }, HONE_TREE_TIMEOUT);

  it("leaves files with no directive-shaped comment out of the scope set once the team's configuration names the TypeScript parser, and the team's own run gives the same hits on them as the governance lint", async () => {
    const proof = await scopeSetProof(
      honeTreeSubject({ line: "eslint-10", teamParser: "typescript-parser-block", git: createDefaultGitPort({}) }),
    );
    expect(provenOf({ proof })).toEqual(
      identityWith({
        proof,
        partition: expect.objectContaining({ rest: expect.arrayContaining([FILE_WITH_NO_DIRECTIVE]) }),
      }),
    );
  }, HONE_TREE_TIMEOUT);
});
