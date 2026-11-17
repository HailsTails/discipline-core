import { describe, expect, it } from "vitest";
import {
  environmentWithoutGit,
  judgedStep,
  PROOF_CASES,
  packagedConsumerManifest,
  packagedScriptsOf,
  type ProofAction,
  requiredPeerPinsOf,
  type StepExpectation,
  toolchainManifest,
} from "./install-proof-plan.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const packageFiles = import.meta.glob(["../package.json"], {
  base: "./",
  query: "?raw",
  import: "default",
  eager: true,
});

const FAILING_REPORT = "findings (1)\nCD-23#export-test-sibling audit src/kept.ts:1:0 missing co-located *.test.ts(x) sibling\nverdict: fail\n";

const FAILING: StepExpectation = { exitCode: 1, output: FAILING_REPORT };

const SILENT: StepExpectation = { exitCode: 0, output: "" };

describe("judgedStep", () => {
  it("passes on the expected exit and exactly the expected output", () => {
    expect(judgedStep({ label: "audit check", expectation: FAILING, run: { outcome: "exited", exitCode: 1, output: FAILING_REPORT } })).toEqual({
      outcome: "ok",
      value: "ok: audit check -> exit 1, output exactly as expected",
    });
  });

  it("fails on an exit mismatch, showing the expected and the captured output", () => {
    expect(judgedStep({ label: "audit check", expectation: SILENT, run: { outcome: "exited", exitCode: 1, output: "" } })).toEqual({
      outcome: "failed",
      error: 'FAIL: audit check: expected exit 0 and output "", got exit 1 and output ""',
    });
  });

  it.each([
    {
      change: "a finding line",
      output: "findings (1)\nCD-23#export-test-sibling audit src/kept.ts:2:0 missing co-located *.test.ts(x) sibling\nverdict: fail\n",
    },
    {
      change: "a section header",
      output: "findings [1]\nCD-23#export-test-sibling audit src/kept.ts:1:0 missing co-located *.test.ts(x) sibling\nverdict: fail\n",
    },
    { change: "an extra section", output: `excluded (1)\nvendor\n${FAILING_REPORT}` },
    { change: "only the verdict line", output: "verdict: fail\n" },
  ])("fails when $change differs, even with the verdict kept", ({ output }) => {
    expect(judgedStep({ label: "audit check", expectation: FAILING, run: { outcome: "exited", exitCode: 1, output } })).toEqual({
      outcome: "failed",
      error: `FAIL: audit check: expected exit 1 and output ${JSON.stringify(FAILING_REPORT)}, got exit 1 and output ${JSON.stringify(output)}`,
    });
  });

  it("fails an expectation of no output on any output", () => {
    expect(judgedStep({ label: "audit project", expectation: SILENT, run: { outcome: "exited", exitCode: 0, output: "a written\n" } })).toEqual({
      outcome: "failed",
      error: 'FAIL: audit project: expected exit 0 and output "", got exit 0 and output "a written\\n"',
    });
  });

  it("fails a run that did not exit", () => {
    expect(judgedStep({ label: "audit project", expectation: SILENT, run: { outcome: "not-exited", detail: "spawn ENOENT" } })).toEqual({
      outcome: "failed",
      error: 'FAIL: audit project: expected exit 0 and output "", but it did not exit: spawn ENOENT',
    });
  });
});
const manifestText = (request: { readonly devDependencies: Readonly<Record<string, string>> }): string =>
  `${JSON.stringify({ private: true, devDependencies: request.devDependencies }, null, 2)}\n`;

const FLOOR_ESLINT_PEERS = {
  typescript: "4.8.4",
  "@typescript-eslint/parser": "8.56.0",
  "@typescript-eslint/eslint-plugin": "8.56.0",
};

describe("requiredPeerPinsOf", () => {
  it.each([{ toolchain: "typescript-floor" }, { toolchain: "eslint-9-floor" }, { toolchain: "eslint-10-floor" }] as const)(
    "pins only the required peer typescript at its floor for a $toolchain consumer, over this package's own package.json",
    ({ toolchain }) => {
      expect(requiredPeerPinsOf({ developmentManifest: packageFiles["../package.json"], toolchain })).toEqual({
        outcome: "ok",
        value: { typescript: "4.8.4" },
      });
    },
  );

  it("pins typescript at the development version this package is built with for a typescript-current consumer", () => {
    expect(requiredPeerPinsOf({ developmentManifest: packageFiles["../package.json"], toolchain: "typescript-current" })).toEqual({
      outcome: "ok",
      value: { typescript: "6.0.3" },
    });
  });

  it("pins nothing when every peer is optional", () => {
    expect(
      requiredPeerPinsOf({
        developmentManifest:
          '{ "peerDependencies": { "typescript": ">=4.8.4 <7.0.0" }, "peerDependenciesMeta": { "typescript": { "optional": true } }, "devDependencies": { "typescript-floor": "npm:typescript@4.8.4" } }',
        toolchain: "typescript-floor",
      }),
    ).toEqual({ outcome: "ok", value: {} });
  });
});

describe("toolchainManifest, over this package's own package.json read as a build-time raw module", () => {
  it("gives the TypeScript floor root only typescript, at its floor pin installed under its own name", () => {
    expect(toolchainManifest({ developmentManifest: packageFiles["../package.json"], toolchain: "typescript-floor" })).toEqual({
      outcome: "ok",
      value: manifestText({ devDependencies: { typescript: "4.8.4" } }),
    });
  });

  it("gives the current TypeScript root only typescript, at the development version installed under its own name", () => {
    expect(toolchainManifest({ developmentManifest: packageFiles["../package.json"], toolchain: "typescript-current" })).toEqual({
      outcome: "ok",
      value: manifestText({ devDependencies: { typescript: "6.0.3" } }),
    });
  });

  it.each([
    { toolchain: "eslint-9-floor", eslint: "9.28.0" },
    { toolchain: "eslint-10-floor", eslint: "10.0.0" },
  ] as const)("gives the $toolchain root every peer at its floor pin, ESLint at $eslint", ({ toolchain, eslint }) => {
    expect(toolchainManifest({ developmentManifest: packageFiles["../package.json"], toolchain })).toEqual({
      outcome: "ok",
      value: manifestText({ devDependencies: { ...FLOOR_ESLINT_PEERS, eslint } }),
    });
  });

  it("fails on a manifest that is not JSON", () => {
    expect(toolchainManifest({ developmentManifest: "{", toolchain: "typescript-floor" }).outcome).toBe("failed");
  });

  it("fails naming a peer whose floor has no development pin", () => {
    expect(
      toolchainManifest({
        developmentManifest: '{ "peerDependencies": { "typescript": ">=4.8.4 <7.0.0" }, "devDependencies": {} }',
        toolchain: "typescript-floor",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "manifest-invalid", detail: "no development pin typescript-floor for the peer typescript" } });
  });

  it("fails when a floor pin aliases a different package than the peer it stands for", () => {
    expect(
      toolchainManifest({
        developmentManifest: '{ "peerDependencies": { "typescript": ">=4.8.4 <7.0.0" }, "devDependencies": { "typescript-floor": "npm:typescript-legacy@4.8.4" } }',
        toolchain: "typescript-floor",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "manifest-invalid", detail: "the development pin typescript-floor is npm:typescript-legacy@4.8.4, not an alias of typescript" },
    });
  });

  it("fails when a pinned package is not a declared peer", () => {
    expect(
      toolchainManifest({
        developmentManifest: '{ "peerDependencies": {}, "devDependencies": { "typescript-floor": "npm:typescript@4.8.4" } }',
        toolchain: "typescript-floor",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "manifest-invalid", detail: "typescript is not a declared peer" } });
  });
});

const PROJECTION = `import piece0 from "@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error", "hone/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },
  },
];
`;

const ESLINT_ACTIONS: readonly ProofAction[] = [
  { kind: "project", expectation: { exitCode: 0, output: "disciplines.eslint.mjs written\n" } },
  { kind: "read", path: "disciplines.eslint.mjs", text: PROJECTION },
  { kind: "commit", message: "project" },
  {
    kind: "check",
    expectation: { exitCode: 1, output: "findings (1)\nCD-14#class-syntax eslint src/kept.ts:1:7 export class Kept {}\nverdict: fail\n" },
  },
  { kind: "remove", path: "src/kept.ts" },
  { kind: "commit", message: "clean" },
  { kind: "check", expectation: { exitCode: 0, output: "verdict: pass\n" } },
];

const AUDIT_ACTIONS: readonly ProofAction[] = [
  { kind: "check", expectation: FAILING },
  { kind: "remove", path: "src/kept.ts" },
  { kind: "commit", message: "clean" },
  { kind: "check", expectation: { exitCode: 0, output: "verdict: pass\n" } },
  { kind: "project", expectation: SILENT },
];

const ESLINT_MISSING_ACTIONS: readonly ProofAction[] = [
  {
    kind: "project",
    expectation: {
      exitCode: 2,
      output:
        "load failure: runner-failed eslint toolchain-unavailable eslint found not installed, supported ^9.28.0 || ^10.0.0: add a supported version to the devDependencies of the repository root\n",
    },
  },
];

const WRONG_FIELD_REPORT =
  "src/wrong-piece.mts(16,27): error TS2345: Argument of type '{ clause: ClauseAddress; anchor: Anchor; snippet: number; }' is not assignable to parameter of type 'PieceHit'.\n  Types of property 'snippet' are incompatible.\n    Type 'number' is not assignable to type 'string'.\n";

const TYPED_FLOOR_ACTIONS: readonly ProofAction[] = [
  { kind: "typecheck", project: "tsconfig.nodenext.json", expectation: SILENT },
  { kind: "typecheck", project: "tsconfig.wrong.json", expectation: { exitCode: 2, output: WRONG_FIELD_REPORT } },
];

const TYPED_CURRENT_ACTIONS: readonly ProofAction[] = [
  { kind: "typecheck", project: "tsconfig.nodenext.json", expectation: SILENT },
  { kind: "typecheck", project: "tsconfig.bundler.json", expectation: SILENT },
  { kind: "typecheck", project: "tsconfig.wrong.json", expectation: { exitCode: 2, output: WRONG_FIELD_REPORT } },
];

describe("the proof cases", () => {
  it("install the packed package into an audit-only consumer, an ESLint consumer on each line's floor, one missing eslint and a typed team piece on the TypeScript floor and current version, projecting with the package's own import", () => {
    expect(PROOF_CASES).toEqual([
      { consumer: "audit", fixture: "audit", toolchain: "typescript-floor", actions: AUDIT_ACTIONS },
      { consumer: "eslint-10", fixture: "eslint", toolchain: "eslint-10-floor", actions: ESLINT_ACTIONS },
      { consumer: "eslint-9", fixture: "eslint", toolchain: "eslint-9-floor", actions: ESLINT_ACTIONS },
      { consumer: "eslint-missing", fixture: "eslint", toolchain: "typescript-floor", actions: ESLINT_MISSING_ACTIONS },
      { consumer: "typed-floor", fixture: "typed-team-piece", toolchain: "typescript-floor", actions: TYPED_FLOOR_ACTIONS },
      { consumer: "typed-current", fixture: "typed-team-piece", toolchain: "typescript-current", actions: TYPED_CURRENT_ACTIONS },
    ]);
  });
  it("name a packaged consumer's scripts after the command and its subcommands", () => {
    expect(packagedScriptsOf({ identity: { name: "Core", packageName: "core-package", command: "core", ownRuleSet: "core", reservedEslintNamespace: "core-package", description: "Core.", repository: "https://github.com/example/core", unrelatedNpmPackage: "core" } })).toEqual({
      check: "core:check",
      project: "core:project",
    });
  });
  it("give a packaged consumer scripts calling the command's two subcommands on the repository root, and its required peers as development dependencies at the given pins", () => {
    expect(
      packagedConsumerManifest({
        identity: { name: "Core", packageName: "core-package", command: "core", ownRuleSet: "core", reservedEslintNamespace: "core-package", description: "Core.", repository: "https://github.com/example/core", unrelatedNpmPackage: "core" },
        requiredPeers: { typescript: "4.8.4" },
      }),
    ).toBe(
      `${JSON.stringify(
        {
          private: true,
          type: "commonjs",
          scripts: { "core:check": "core check --repo .", "core:project": "core project --repo ." },
          devDependencies: { typescript: "4.8.4" },
        },
        null,
        2,
      )}\n`,
    );
  });
});

describe("environmentWithoutGit", () => {
  it("removes every GIT_ variable and keeps the rest", () => {
    expect(environmentWithoutGit({ environment: { GIT_DIR: "/x", GIT_INDEX_FILE: "/y", PATH: "/bin", HOME: "/h" } })).toEqual({
      PATH: "/bin",
      HOME: "/h",
    });
  });
});
