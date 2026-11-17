import { assert, describe, expect, it, vi } from "vitest";
import { runCheck } from "../core/check/run-check.ts";
import { toolchainBoundEmbeddedRunner } from "../core/mechanism-port/toolchain-bound-runner.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import type { PackageLocationPort } from "../core/platform-ports/package-location-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { type Assessment, DEFAULT_ASSESSMENT } from "../core/values/assessment.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "../mechanisms/eslint/runner/create-eslint-runner.ts";
import { createEslintPort } from "../mechanisms/eslint/runner/eslint-instance.ts";
import { loadEslintToolchain } from "../mechanisms/eslint/runner/eslint-toolchain.ts";
import { eslintPeersOn, modulesServingRunner } from "./eslint-toolchains.ts";
import { overlaidFileText } from "./overlaid-file-text.ts";

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/..` });

const REPO_ROOT = resolvedPath({ path: `${import.meta.dirname}/test-fixtures/single-mechanism` });

const ESLINT_RUNNER_SUFFIX = "/mechanisms/eslint/runner/runner.ts";

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
      fileText,
      modules: createDefaultModuleLoaderPort({}),
      path,
      eslint: createEslintPort({ toolchain }),
      moduleExtension: ".ts",
    }),
});

const modulesServingEslintRunner = (request: { readonly runner: unknown }): ModuleLoaderPort =>
  modulesServingRunner({ runnerSuffix: ESLINT_RUNNER_SUFFIX, runner: request.runner, base: createDefaultModuleLoaderPort({}) });

const PEERLESS_ESLINT = modulesServingEslintRunner({ runner: eslintRunnerWithoutPeers });

const UNLOADABLE_ESLINT = modulesServingEslintRunner({ runner: undefined });

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
  readonly selection: Readonly<Record<string, string>>;
}) =>
  runCheck({
    repoRoot: REPO_ROOT,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    baseRevision: undefined,
    assessment: request.assessment,
    fileText: overlaidFileText({ base: fileText, files: request.selection }),
    modules: request.modules,
    path,
    git,
  });

describe("adopting CD-6 through the audit only, with the ESLint clause waived and not run, and no ESLint installed", () => {
  it("passes with no ESLint peer resolvable, naming the clause it did not run", async () => {
    expect(await checkOf({ assessment: NOT_RUN, modules: PEERLESS_ESLINT, selection: {} })).toEqual(AUDIT_ONLY_REPORT);
  });

  it("never loads the ESLint mechanism's module", async () => {
    expect(await checkOf({ assessment: NOT_RUN, modules: UNLOADABLE_ESLINT, selection: {} })).toEqual(AUDIT_ONLY_REPORT);
  });

  it("fails as today when the waived clause is run, because the ESLint mechanism needs its peers", async () => {
    const checked = await checkOf({ assessment: DEFAULT_ASSESSMENT, modules: PEERLESS_ESLINT, selection: {} });
    expect(checked).toMatchObject({
      outcome: "failed",
      error: { kind: "runner-failed", mechanism: "eslint", failure: { kind: "toolchain-unavailable", packageName: "eslint" } },
    });
  });

  it("reports the ESLint clause uncovered when only the audit clause is selected, which is why the waiver is needed", async () => {
    const checked = await checkOf({
      assessment: DEFAULT_ASSESSMENT,
      modules: PEERLESS_ESLINT,
      selection: {
        [`${REPO_ROOT}/disciplines.json`]: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-6#identifier-names": "audit" } }),
        [`${REPO_ROOT}/discipline-exceptions.json`]: JSON.stringify({ version: 1, exceptions: [] }),
      },
    });
    expect(checked).toMatchObject({
      outcome: "ok",
      value: { findings: [], uncovered: [{ ruleSet: "hone", discipline: "CD-6", clause: "naming-convention" }] },
    });
  });
});
