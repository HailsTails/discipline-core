import { describe, expect, it, vi } from "vitest";
import { createDefaultGitPort, type GitPort } from "../core/platform-ports/git-port.ts";
import { type RepoPath, repoPathSchema } from "../core/values/repo-path.ts";
import { ESLINT_LINES, type EslintLine } from "./eslint-toolchains.ts";
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

const PINNED_LINE: EslintLine = "eslint-10";

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

const IDENTITY_FIXTURES = [
  {
    fixture: "global-ignore",
    tracked: ["gen/g.ts", "src/clean.ts"],
    partition: { scopeSet: [{ file: "gen/g.ts", reasons: ["ignored"] }], rest: ["src/clean.ts"] },
  },
  {
    fixture: "options-differ",
    tracked: ["narrow.ts", "wide.ts"],
    partition: { scopeSet: [{ file: "wide.ts", reasons: ["rule-differs"] }], rest: ["narrow.ts"] },
  },
  {
    fixture: "route-brackets",
    tracked: ["route/[id].ts", "route/i.ts"],
    partition: { scopeSet: [{ file: "route/[id].ts", reasons: ["rule-differs"] }], rest: ["route/i.ts"] },
  },
  {
    fixture: "projection-hand-edited",
    tracked: ["x.ts"],
    partition: { scopeSet: [], rest: ["x.ts"] },
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
    partition: {
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

describe.each(ESLINT_LINES)("identity on %s: consumer repositories whose rest is not empty", (line) => {
  it.each(IDENTITY_FIXTURES)(
    "$fixture with the TypeScript parser in the team's configuration: the team's own run over the rest gives the governance hits there, and the scoped report equals the full report byte for byte",
    async ({ fixture, tracked, partition }) => {
      const proof = await scopeSetProof(
        fixtureSubject({ line, teamParser: "typescript-parser-block", fixture, git: gitTracking({ tracked }) }),
      );
      expect(provenOf({ proof })).toEqual(identityWith({ proof, partition }));
    },
  );
});

const SUPPRESSION_CONTROLS = [
  {
    fixture: "suppression-default",
    tracked: ["supp/a.ts", "eslint-suppressions.json"],
    teamSuppressions: { applied: "default-location" },
    partition: { scopeSet: [{ file: "supp/a.ts", reasons: ["suppression-entry"] }], rest: [] },
  },
  {
    fixture: "suppression-scripted",
    tracked: ["supp/b.ts", "supp/clean.ts", "package.json", "custom/supp.json", "custom/supp2.json"],
    teamSuppressions: { applied: "named-location", location: "custom/supp.json" },
    partition: {
      scopeSet: [
        { file: "supp/b.ts", reasons: ["suppression-entry"] },
        { file: "supp/clean.ts", reasons: ["suppression-entry"] },
      ],
      rest: [],
    },
  },
] as const;

describe("identity on eslint-10 with the team's run applying its suppressions, the negative control for suppression-entry", () => {
  it.each(SUPPRESSION_CONTROLS)(
    "$fixture: a suppressed file left to the team's run would lose its hit, so the scoped report equals the full report only while suppression-entry keeps it in the scope set",
    async ({ fixture, tracked, teamSuppressions, partition }) => {
      const proof = await scopeSetProof(
        fixtureSubject({
          line: PINNED_LINE,
          teamParser: "typescript-parser-block",
          teamSuppressions,
          fixture,
          git: gitTracking({ tracked }),
        }),
      );
      expect(provenOf({ proof })).toEqual(identityWith({ proof, partition }));
    },
  );
});

const PACKAGE_FILE_IN_REST = { scopeSet: [], rest: ["packages/a/x.ts"] };

const PACKAGE_FILE_PARSED_BY_DEFAULT = {
  scopeSet: [{ file: "packages/a/x.ts", reasons: ["parser-differs"] }],
  rest: [],
};

const IDENTITY_MONOREPOS = [
  { fixture: "monorepo-package-config", version: "10.11.0", lintCommand: "eslint ." },
  {
    fixture: "monorepo-package-config",
    version: "9.39.5",
    lintCommand: "eslint --flag v10_config_lookup_from_file .",
  },
  { fixture: "monorepo-root-config", version: "9.39.5", lintCommand: "eslint ." },
];

describe.each(ESLINT_LINES)("identity on %s: monorepos whose package file is in the rest", (line) => {
  it.each(IDENTITY_MONOREPOS)(
    "$fixture under ESLint $version running `$lintCommand` with the TypeScript parser in the team's configuration: the scoped report equals the full report byte for byte",
    async ({ fixture, version, lintCommand }) => {
      const proof = await scopeSetProof(
        monorepoSubject({
          line,
          teamParser: "typescript-parser-block",
          fixture,
          eslintVersion: version,
          lintCommand,
          git: gitTracking({ tracked: MONOREPO_TRACKED }),
        }),
      );
      expect(provenOf({ proof })).toEqual(identityWith({ proof, partition: PACKAGE_FILE_IN_REST }));
    },
  );
});

const HONE_TREE_TIMEOUT = 120_000;

const FILE_WITH_NO_DIRECTIVE: RepoPath = repoPathSchema.parse("core/check/run-check.ts");

describe("identity on eslint-10 over Hone's own tracked tree", () => {
  it("leaves files with no directive-shaped comment out of the scope set once the team's configuration names the TypeScript parser, and the team's own run gives the same hits on them as the governance lint", async () => {
    const proof = await scopeSetProof(
      honeTreeSubject({ line: PINNED_LINE, teamParser: "typescript-parser-block", git: createDefaultGitPort({}) }),
    );
    expect(provenOf({ proof })).toEqual(
      identityWith({
        proof,
        partition: expect.objectContaining({ rest: expect.arrayContaining([FILE_WITH_NO_DIRECTIVE]) }),
      }),
    );
  }, HONE_TREE_TIMEOUT);
});

const AS_CONFIGURED_FIXTURES = [
  { fixture: "override-after", tracked: ["x.ts"], partition: EVERY_FILE_IN_SCOPE },
  { fixture: "global-ignore", tracked: ["gen/g.ts", "src/clean.ts"], partition: EVERY_FILE_IN_SCOPE },
  { fixture: "severity-zero", tracked: ["x.ts"], partition: EVERY_FILE_IN_SCOPE },
  { fixture: "options-differ", tracked: ["narrow.ts", "wide.ts"], partition: EVERY_FILE_IN_SCOPE },
  { fixture: "re-enabled-record", tracked: ["src/owned.ts"], partition: NO_GOVERNANCE_LINT },
  { fixture: "suppression-default", tracked: ["supp/a.ts", "eslint-suppressions.json"], partition: EVERY_FILE_IN_SCOPE },
  {
    fixture: "suppression-scripted",
    tracked: ["supp/b.ts", "supp/clean.ts", "package.json", "custom/supp.json", "custom/supp2.json"],
    partition: EVERY_FILE_IN_SCOPE,
  },
  {
    fixture: "suppression-nested",
    tracked: ["packages/a/src/n.ts", "packages/a/eslint-suppressions.json"],
    partition: EVERY_FILE_IN_SCOPE,
  },
  { fixture: "command-line-options", tracked: ["src/plain.ts", "package.json"], partition: EVERY_FILE_IN_SCOPE },
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
    partition: EVERY_FILE_IN_SCOPE,
  },
  { fixture: "route-brackets", tracked: ["route/[id].ts", "route/i.ts"], partition: EVERY_FILE_IN_SCOPE },
  { fixture: "projection-missing", tracked: ["x.ts"], partition: NO_GOVERNANCE_LINT },
  { fixture: "projection-hand-edited", tracked: ["x.ts"], partition: EVERY_FILE_IN_SCOPE },
  { fixture: "projection-not-imported", tracked: ["x.ts"], partition: NO_GOVERNANCE_LINT },
  { fixture: "fragment-not-projection", tracked: ["src/owned.ts", "src/clean.ts"], partition: NO_GOVERNANCE_LINT },
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
    partition: EVERY_FILE_IN_SCOPE,
  },
];

describe("partition pinned only, on eslint-10: consumer repositories as configured, where ESLint's default parser puts every file in the scope set", () => {
  it.each(AS_CONFIGURED_FIXTURES)(
    "$fixture as configured: the partition is pinned, and with an empty rest the report comparison proves nothing",
    async ({ fixture, tracked, partition }) => {
      const proof = await scopeSetProof(
        fixtureSubject({ line: PINNED_LINE, teamParser: "as-configured", fixture, git: gitTracking({ tracked }) }),
      );
      expect(provenOf({ proof })).toEqual(identityWith({ proof, partition }));
    },
  );
});

const PINNED_TYPESCRIPT_FIXTURES = [
  {
    fixture: "override-after",
    tracked: ["x.ts"],
    partition: { scopeSet: [{ file: "x.ts", reasons: ["rule-differs"] }], rest: [] },
  },
  {
    fixture: "severity-zero",
    tracked: ["x.ts"],
    partition: { scopeSet: [{ file: "x.ts", reasons: ["rule-differs"] }], rest: [] },
  },
  { fixture: "re-enabled-record", tracked: ["src/owned.ts"], partition: NO_GOVERNANCE_LINT },
  {
    fixture: "suppression-nested",
    tracked: ["packages/a/src/n.ts", "packages/a/eslint-suppressions.json"],
    partition: { scopeSet: [{ file: "packages/a/src/n.ts", reasons: ["suppression-entry"] }], rest: [] },
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
    partition: {
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
  { fixture: "projection-missing", tracked: ["x.ts"], partition: NO_GOVERNANCE_LINT },
  { fixture: "projection-not-imported", tracked: ["x.ts"], partition: NO_GOVERNANCE_LINT },
  { fixture: "fragment-not-projection", tracked: ["src/owned.ts", "src/clean.ts"], partition: NO_GOVERNANCE_LINT },
];

describe("partition pinned only, on eslint-10: consumer repositories with the TypeScript parser in the team's configuration and an empty rest", () => {
  it.each(PINNED_TYPESCRIPT_FIXTURES)(
    "$fixture: the partition is pinned, and with an empty rest the report comparison proves nothing",
    async ({ fixture, tracked, partition }) => {
      const proof = await scopeSetProof(
        fixtureSubject({ line: PINNED_LINE, teamParser: "typescript-parser-block", fixture, git: gitTracking({ tracked }) }),
      );
      expect(provenOf({ proof })).toEqual(identityWith({ proof, partition }));
    },
  );

  it("command-line-options: command-line-option is pinned by the partition only, not proven by report comparison, because the team's Node API run cannot replay a lint script's options", async () => {
    const proof = await scopeSetProof(
      fixtureSubject({
        line: PINNED_LINE,
        teamParser: "typescript-parser-block",
        fixture: "command-line-options",
        git: gitTracking({ tracked: ["src/plain.ts", "package.json"] }),
      }),
    );
    expect(provenOf({ proof })).toEqual(
      identityWith({
        proof,
        partition: { scopeSet: [{ file: "src/plain.ts", reasons: ["command-line-option"] }], rest: [] },
      }),
    );
  });
});

const PINNED_MONOREPOS = [
  {
    fixture: "monorepo-package-config",
    version: "10.11.0",
    lintCommand: "eslint .",
    teamParser: "as-configured",
    partition: PACKAGE_FILE_PARSED_BY_DEFAULT,
  },
  {
    fixture: "monorepo-package-config",
    version: "9.39.5",
    lintCommand: "eslint --flag v10_config_lookup_from_file .",
    teamParser: "as-configured",
    partition: PACKAGE_FILE_PARSED_BY_DEFAULT,
  },
  {
    fixture: "monorepo-root-config",
    version: "9.39.5",
    lintCommand: "eslint .",
    teamParser: "as-configured",
    partition: PACKAGE_FILE_PARSED_BY_DEFAULT,
  },
  {
    fixture: "monorepo-package-config",
    version: "9.39.5",
    lintCommand: "eslint .",
    teamParser: "as-configured",
    partition: NO_GOVERNANCE_LINT,
  },
  {
    fixture: "monorepo-root-config",
    version: "10.11.0",
    lintCommand: "eslint .",
    teamParser: "as-configured",
    partition: NO_GOVERNANCE_LINT,
  },
  {
    fixture: "monorepo-root-config",
    version: "9.39.5",
    lintCommand: "eslint --flag v10_config_lookup_from_file .",
    teamParser: "as-configured",
    partition: NO_GOVERNANCE_LINT,
  },
  {
    fixture: "monorepo-package-config",
    version: "9.39.5",
    lintCommand: "eslint .",
    teamParser: "typescript-parser-block",
    partition: NO_GOVERNANCE_LINT,
  },
  {
    fixture: "monorepo-root-config",
    version: "10.11.0",
    lintCommand: "eslint .",
    teamParser: "typescript-parser-block",
    partition: NO_GOVERNANCE_LINT,
  },
  {
    fixture: "monorepo-root-config",
    version: "9.39.5",
    lintCommand: "eslint --flag v10_config_lookup_from_file .",
    teamParser: "typescript-parser-block",
    partition: NO_GOVERNANCE_LINT,
  },
] as const;

describe.each(ESLINT_LINES)("partition pinned only, on %s: monorepos whose rest is empty", (line) => {
  it.each(PINNED_MONOREPOS)(
    "$fixture under ESLint $version running `$lintCommand`, $teamParser: the partition is pinned, and with an empty rest the report comparison proves nothing",
    async ({ fixture, version, lintCommand, teamParser, partition }) => {
      const proof = await scopeSetProof(
        monorepoSubject({
          line,
          teamParser,
          fixture,
          eslintVersion: version,
          lintCommand,
          git: gitTracking({ tracked: MONOREPO_TRACKED }),
        }),
      );
      expect(provenOf({ proof })).toEqual(identityWith({ proof, partition }));
    },
  );
});
