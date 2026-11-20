import { describe, expect, it, vi } from "vitest";
import { createDefaultFileRemovalPort } from "../../../core/platform-ports/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import type { ChecksRunRequest } from "./checks-run-types.ts";
import { checksRunnerOver } from "./checks-runner.ts";
import type { EslintRunnerPorts } from "./create-eslint-runner.ts";
import type { EslintPort } from "./eslint-instance.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";

const eslint: EslintPort = {
  createQueryInstance: vi.fn<EslintPort["createQueryInstance"]>(),
  createGovernanceInstance: vi.fn<EslintPort["createGovernanceInstance"]>(),
  ignoredByConfig: vi.fn<EslintPort["ignoredByConfig"]>(),
  ignoredByPatterns: vi.fn<EslintPort["ignoredByPatterns"]>(),
  lintSourceCases: vi.fn<EslintPort["lintSourceCases"]>(),
};

const path = createDefaultPathPort({});

const modules: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };

const runner = checksRunnerOver({
  ports: { repositoryAt: vi.fn<EslintRunnerPorts["repositoryAt"]>(), coreInstall: vi.fn<EslintRunnerPorts["coreInstall"]>(), modules, path, eslint },
  platform: { fileText: createDefaultFileTextPort({}), fileRemoval: createDefaultFileRemovalPort({}), modules, path, eslint, moduleExtension: ".ts" },
});

const REQUEST: ChecksRunRequest = {
  repoRoot: absolutePathSchema.parse("/repo"),
  installRoot: absolutePathSchema.parse("/install"),
  files: [repoPathSchema.parse("src/a.ts")],
  trackedPaths: [repoPathSchema.parse("src/a.ts")],
  checks: [],
  bindings: [],
  answered: [],
  declaredConfigRoots: [],
};

const NOT_READY = { outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots" } } };

describe("checksRunnerOver", () => {
  it("is not ready for a repository that declares ESLint config roots, before touching any port", async () => {
    expect(await runner.run({ ...REQUEST, declaredConfigRoots: [repoPathSchema.parse("packages/web")] })).toEqual(NOT_READY);
  });

  it("is not ready for a repository holding a nested repository with files to check", async () => {
    expect(
      await runner.run({
        ...REQUEST,
        files: [repoPathSchema.parse("vendor/lib/src/a.ts")],
        trackedPaths: [repoPathSchema.parse("vendor/lib/hone.config.json"), repoPathSchema.parse("vendor/lib/src/a.ts")],
      }),
    ).toEqual(NOT_READY);
  });

  it("reports a current projection and no findings when no check runs on ESLint", async () => {
    expect(await runner.run(REQUEST)).toEqual({
      outcome: "ok",
      value: { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current" },
    });
  });
});
