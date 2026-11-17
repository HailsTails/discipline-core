import { assert, describe, expect, it, vi } from "vitest";
import { runCheck } from "../core/check/run-check.ts";
import { toolchainBoundEmbeddedRunner, toolchainBoundStandaloneRunner } from "../core/mechanism-port/toolchain-bound-runner.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import type { PackageLocationPort } from "../core/platform-ports/package-location-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { type Assessment, DEFAULT_ASSESSMENT } from "../core/values/assessment.ts";
import { installFormOf } from "../core/values/install-layout.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import { createWalkerRunner } from "../mechanisms/audit/runner/create-walker-runner.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../mechanisms/audit/runner/typescript-toolchain.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "../mechanisms/eslint/runner/create-eslint-runner.ts";
import { createEslintPort } from "../mechanisms/eslint/runner/eslint-instance.ts";
import { loadEslintToolchain } from "../mechanisms/eslint/runner/eslint-toolchain.ts";
import { CAUSAL_WHY_CHAIN } from "./causal-why-chain.ts";
import { eslintPeersOn, modulesServingRunner } from "./eslint-toolchains.ts";
import { overlaidFileText } from "./overlaid-file-text.ts";

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/..` });

const REPO_ROOT = resolvedPath({ path: `${INSTALL_ROOT}/in-memory-single-mechanism-repository` });

const AUDIT_ONLY_SELECTION = JSON.stringify({
  version: 1,
  ruleSets: {},
  clauses: { "CD-6#identifier-names": "audit", "CD-6#naming-convention": "eslint" },
});

const NAMING_CONVENTION_WAIVED = JSON.stringify({
  version: 1,
  exceptions: [
    {
      kind: "clause-wide-carve-out",
      clause: "CD-6#naming-convention",
      reason: "the repository adopts CD-6 through the audit only and does not run ESLint",
      whyChain: CAUSAL_WHY_CHAIN,
    },
  ],
});

const repositoryFiles = (request: { readonly selection: string; readonly exceptions: string }) =>
  overlaidFileText({
    base: createDefaultFileTextPort({}),
    files: {
      [`${REPO_ROOT}/disciplines.json`]: request.selection,
      [`${REPO_ROOT}/discipline-exceptions.json`]: request.exceptions,
      [`${REPO_ROOT}/src/greeting.ts`]: "export const greetingFor = (visitorName: string): string => visitorName.trim();\n",
    },
  });

const ADOPTING_REPOSITORY = repositoryFiles({ selection: AUDIT_ONLY_SELECTION, exceptions: NAMING_CONVENTION_WAIVED });

const git: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
    outcome: "ok",
    value: [
      repoPathSchema.parse("discipline-exceptions.json"),
      repoPathSchema.parse("disciplines.json"),
      repoPathSchema.parse("src/greeting.ts"),
    ],
  }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
};

const eslintNotInstalled: PackageLocationPort = {
  installRoot: INSTALL_ROOT,
  installForm: "package",
  locate: vi.fn<PackageLocationPort["locate"]>().mockThrow(
    Object.assign(new Error(`Cannot find package 'eslint' imported from ${INSTALL_ROOT}/x.ts`), { code: "ERR_MODULE_NOT_FOUND" }),
  ),
};

const eslintRunnerWithoutPeers = toolchainBoundEmbeddedRunner({
  toolchain: loadEslintToolchain({ peers: { ...eslintPeersOn({ line: "eslint-10" }), location: eslintNotInstalled } }),
  projectedKinds: ESLINT_PROJECTED_KINDS,
  runnerOf: (toolchain) =>
    createEslintRunner({
      fileText: ADOPTING_REPOSITORY,
      modules: createDefaultModuleLoaderPort({}),
      path,
      eslint: createEslintPort({ toolchain }),
      moduleExtension: ".ts",
    }),
});

const auditRunnerOver = (request: { readonly fileText: FileTextPort }) =>
  toolchainBoundStandaloneRunner({
    toolchain: loadParsePort({
      peers: defaultTypeScriptPeers({ installRoot: INSTALL_ROOT, installForm: installFormOf({ moduleExtension: ".ts" }) }),
    }),
    runnerOf: (parse) =>
      createWalkerRunner({ fileText: request.fileText, modules: createDefaultModuleLoaderPort({}), path, parse }),
  });

const modulesServing = (request: { readonly eslintRunner: unknown; readonly fileText: FileTextPort }): ModuleLoaderPort =>
  modulesServingRunner({
    runnerSuffix: "/mechanisms/eslint/runner/runner.ts",
    runner: request.eslintRunner,
    base: modulesServingRunner({
      runnerSuffix: "/mechanisms/audit/runner/runner.ts",
      runner: auditRunnerOver({ fileText: request.fileText }),
      base: createDefaultModuleLoaderPort({}),
    }),
  });

const PEERLESS_ESLINT = modulesServing({ eslintRunner: eslintRunnerWithoutPeers, fileText: ADOPTING_REPOSITORY });

const UNLOADABLE_ESLINT = modulesServing({ eslintRunner: undefined, fileText: ADOPTING_REPOSITORY });

const NOT_RUN: Assessment = { ...DEFAULT_ASSESSMENT, waivedClauses: "not-run" };

const AUDIT_ONLY_REPORT = {
  outcome: "ok",
  value: expect.objectContaining({
    findings: [],
    stale: [],
    uncovered: [],
    invalidRecords: [],
    unmeasured: [],
    assessment: [
      {
        concern: "waivedClauses",
        assessedBy: "not-run",
        clausesNotRun: [{ clause: { ruleSet: "hone", discipline: "CD-6", clause: "naming-convention" }, mechanism: "eslint" }],
        recordsNotJudgedStale: 1,
      },
    ],
  }),
};

const checkOf = (request: {
  readonly assessment: Assessment;
  readonly modules: ModuleLoaderPort;
  readonly fileText: FileTextPort;
}) =>
  runCheck({
    repoRoot: REPO_ROOT,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    baseRevision: undefined,
    assessment: request.assessment,
    fileText: request.fileText,
    modules: request.modules,
    path,
    git,
  });

describe("adopting CD-6 through the audit only, with the ESLint clause waived and not run, and no ESLint installed", () => {
  it("passes with no ESLint peer resolvable, naming the clause it did not run", async () => {
    expect(await checkOf({ assessment: NOT_RUN, modules: PEERLESS_ESLINT, fileText: ADOPTING_REPOSITORY })).toEqual(
      AUDIT_ONLY_REPORT,
    );
  });

  it("never loads the ESLint mechanism's module", async () => {
    expect(await checkOf({ assessment: NOT_RUN, modules: UNLOADABLE_ESLINT, fileText: ADOPTING_REPOSITORY })).toEqual(
      AUDIT_ONLY_REPORT,
    );
  });

  it("fails as today when the waived clause is run, because the ESLint mechanism needs its peers", async () => {
    const checked = await checkOf({ assessment: DEFAULT_ASSESSMENT, modules: PEERLESS_ESLINT, fileText: ADOPTING_REPOSITORY });
    expect(checked).toMatchObject({
      outcome: "failed",
      error: { kind: "runner-failed", mechanism: "eslint", failure: { kind: "toolchain-unavailable", packageName: "eslint" } },
    });
  });

  it("reports the ESLint clause uncovered when only the audit clause is selected, which is why the waiver is needed", async () => {
    const auditOnly = repositoryFiles({
      selection: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-6#identifier-names": "audit" } }),
      exceptions: JSON.stringify({ version: 1, exceptions: [] }),
    });
    const checked = await checkOf({
      assessment: DEFAULT_ASSESSMENT,
      modules: modulesServing({ eslintRunner: eslintRunnerWithoutPeers, fileText: auditOnly }),
      fileText: auditOnly,
    });
    expect(checked).toMatchObject({
      outcome: "ok",
      value: { findings: [], uncovered: [{ ruleSet: "hone", discipline: "CD-6", clause: "naming-convention" }] },
    });
  });
});
