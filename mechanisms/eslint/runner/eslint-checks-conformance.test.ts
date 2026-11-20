import { describe, expect, it } from "vitest";
import { checkConformance } from "../../../core/conformance/conformance.ts";
import { checksRunnerModuleSchema } from "../../../core/mechanism-port/checks-runner-module-schema.ts";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import { toolchainBoundChecksRunner } from "../../../core/mechanism-port/toolchain-bound-runner.ts";
import { createDefaultFileRemovalPort } from "../../../core/platform-ports/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../../../core/platform-ports/path-port.ts";
import { mechanismIdSchema } from "../../../core/values/identifiers.ts";
import type { Result } from "../../../core/values/result.ts";
import { conformanceRows, foldersUnder } from "../../../tests/conformance-rows.ts";
import { ESLINT_LINES, type EslintLine, loadedEslintToolchain, pieceModulesOn } from "../../../tests/eslint-toolchains.ts";
import { createChecksRunner } from "./checks-runner.ts";
import { createEslintPort, type EslintToolchain } from "./eslint-instance.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const ruleSetTexts = import.meta.glob(["./rules/*/discipline.json", "./mechanisms/eslint/*/piece.json"], {
  base: "../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const CONFORMANCE_ROWS = conformanceRows({
  table: ruleSetTexts,
  disciplines: foldersUnder({ table: ruleSetTexts, prefix: "./mechanisms/eslint/" }),
  mechanism: mechanismIdSchema.parse("eslint"),
  mechanismRoot: `${import.meta.dirname}/..`,
});

const checksRunnerOn = (request: { readonly line: EslintLine }) =>
  toolchainBoundChecksRunner({
    toolchain: loadedEslintToolchain(request).then((toolchain): Result<EslintToolchain, RunnerFailure> => ({ outcome: "ok", value: toolchain })),
    projectedKinds: ["config-override", "inline-disable"],
    runnerOf: (toolchain) =>
      createChecksRunner({
        fileText: createDefaultFileTextPort({}),
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: pieceModulesOn({ line: request.line, base: createDefaultModuleLoaderPort({}) }),
        path: createDefaultPathPort({}),
        eslint: createEslintPort({ toolchain }),
        moduleExtension: ".ts",
      }),
  });

describe.each(ESLINT_LINES)("the ESLint checks runner on %s, built as the shipped one is, conforms to every registered ESLint clause's shared cases (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", (line) => {
  const lineRunner = checksRunnerModuleSchema.parse(checksRunnerOn({ line }));

  it.each(CONFORMANCE_ROWS)("$name has no conformance failure over its flag and allow cases", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: row.cases, runner: lineRunner })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});
