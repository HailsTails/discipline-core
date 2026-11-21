import { describe, expect, it } from "vitest";
import {
  filesNotMatching,
  importsOutside,
  packageImport,
  packageOrComputedImport,
  relativeImportNotNaming,
  relativeImportOfAnyForm,
  relativeImportReaching,
  sourcesNamed,
  sourcesNotNamed,
} from "../../../../../tests/confinement.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const runnerSources = import.meta.glob(
  [
    "./src/infrastructure/engines/*/runner/**/*.ts",
    "!./src/infrastructure/engines/*/runner/**/*.test.ts",
    "!./src/infrastructure/engines/eslint/runner/projection/projection-pair/**",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts",
  ],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const walkerRunnerSources = import.meta.glob(["./src/infrastructure/engines/audit/runner/**/*.ts", "!./src/infrastructure/engines/audit/runner/**/*.test.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const eslintRunnerSources = import.meta.glob(
  [
    "./src/infrastructure/engines/eslint/runner/**/*.ts",
    "!./src/infrastructure/engines/eslint/runner/**/*.test.ts",
    "!./src/infrastructure/engines/eslint/runner/native-exceptions/*/**",
    "!./src/infrastructure/engines/eslint/runner/projection/projection-pair/**",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-*/**",
  ],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const vendorImportsTestSources = import.meta.glob(["./src/infrastructure/engines/protocol/confinement/vendor-imports.test.ts"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const everyRunnerFileSources = import.meta.glob(
  [
    "./src/infrastructure/engines/eslint/runner/**/*.ts",
    "!./src/infrastructure/engines/eslint/runner/native-exceptions/*/**",
    "!./src/infrastructure/engines/eslint/runner/projection/projection-pair/**",
    "!./src/infrastructure/engines/eslint/runner/toolchain/eslint-*/**",
    "!./src/infrastructure/engines/eslint/runner/checks-runner/checks-core-agreement.test.ts",
    "!./src/infrastructure/engines/eslint/runner/config-roots/checks-settings-agreement.test.ts",
    "!./src/infrastructure/engines/eslint/runner/projection/projection-pair.integration.test.ts",
    "!./src/infrastructure/engines/eslint/runner/projection/projection-type.test.ts",
  ],
  { base: "../../../../../", query: "?raw", import: "default", eager: true },
);

const LEFT_OUT_OF_THE_SCAN: readonly string[] = [
  "create-eslint-runner.ts",
  "create-eslint-runner.test.ts",
  "eslint-conformance.test.ts",
  "eslint-repository.ts",
  "eslint-repository.test.ts",
  "native-exceptions.integration.test.ts",
  "projection-holding.ts",
  "projection-holding.test.ts",
  "projection-slices.ts",
  "projection-slices.test.ts",
  "projection-text.ts",
  "projection-text.test.ts",
  "runner.ts",
  "runner.test.ts",
  "sliced-projection.ts",
  "sliced-projection.test.ts",
];

const versionTwoRunnerSources = sourcesNotNamed({ sources: everyRunnerFileSources, files: LEFT_OUT_OF_THE_SCAN });

const leftOutRunnerSources = sourcesNamed({ sources: everyRunnerFileSources, files: LEFT_OUT_OF_THE_SCAN });

const reachesNoVersionOneOnlyRunnerFile = relativeImportNotNaming({ importingFolder: "src/infrastructure/engines/eslint/runner", files: LEFT_OUT_OF_THE_SCAN });

const walkerRunnerReach = relativeImportReaching({
  importingFolder: "src/infrastructure/engines/audit/runner",
  reach: /^(?:src\/infrastructure\/engines\/audit\/runner\/|core\/(?:mechanism-port|values|platform-ports|rule-set-reader|upgrade\/version-one-records)\/)/,
});

const eslintRunnerReach = relativeImportReaching({
  importingFolder: "src/infrastructure/engines/eslint/runner",
  reach: /^(?:src\/infrastructure\/engines\/eslint\/runner\/|core\/(?:mechanism-port|values|platform-ports|rule-set-reader|upgrade\/version-one-records)\/)/,
});

const vitestImport = packageImport({ packageName: "vitest" });

const REACHES_ONLY_NAMED_CORE_FOLDERS =
  /^(?!.*(?:\bfrom|\bimport)\s*\(?\s*["'](?:\.\.\/)+core\/(?!(?:mechanism-port|values|platform-ports|rule-set-reader|upgrade\/version-one-records)\/)).*$/s;

const TAKES_ONLY_TYPES_FROM_EXCEPTION_RECORDS =
  /^(?!.*(?:\b(?:import|export)\s+(?!type\s)[^;]*?\bfrom\s*|\bimport\s*\(?\s*)["'](?:\.\.\/)+core\/upgrade\/version-one-records\/).*$/s;


describe("FR-8 and AR-1 runner reach into core and its own mechanism over what this repository's own runner source imports, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("reads a known file through every scanned set, so no set is silently empty", () => {
    expect({ runnerSources, walkerRunnerSources, eslintRunnerSources }).toEqual({
      runnerSources: expect.objectContaining({
        "./src/infrastructure/engines/audit/runner/create-walker-runner.ts": expect.any(String),
        "./src/infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts": expect.any(String),
      }),
      walkerRunnerSources: expect.objectContaining({ "./src/infrastructure/engines/audit/runner/create-walker-runner.ts": expect.any(String) }),
      eslintRunnerSources: expect.objectContaining({ "./src/infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts": expect.any(String) }),
    });
  });

  it("finds every runner file importing from core only mechanism-port, values, platform-ports, rule-set-reader, and types from upgrade/version-one-records", () => {
    expect({
      importingACoreFolderOutsideTheNamedFolders: filesNotMatching({
        sources: runnerSources,
        pattern: REACHES_ONLY_NAMED_CORE_FOLDERS,
      }),
      importingAValueFromExceptionRecords: filesNotMatching({
        sources: runnerSources,
        pattern: TAKES_ONLY_TYPES_FROM_EXCEPTION_RECORDS,
      }),
    }).toEqual({ importingACoreFolderOutsideTheNamedFolders: [], importingAValueFromExceptionRecords: [] });
  });

  it("finds every audit runner import resolving inside the audit runner or core's named folders", () => {
    expect(
      importsOutside({ sources: walkerRunnerSources, allowed: [walkerRunnerReach, packageOrComputedImport] }),
    ).toEqual([]);
  });

  it("finds every ESLint runner import resolving inside the ESLint runner or core's named folders", () => {
    expect(
      importsOutside({ sources: eslintRunnerSources, allowed: [eslintRunnerReach, packageOrComputedImport] }),
    ).toEqual([]);
  });

  it("leaves out of the scan exactly the seven version 1-only runner files, their tests, and the two version 1 tests, each by full file name", () => {
    expect(leftOutRunnerSources).toEqual({
      "./src/infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.test.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/conformance/eslint-conformance.test.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/embedded-runner/eslint-repository.test.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/embedded-runner/eslint-repository.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/native-exceptions/native-exceptions.integration.test.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/projection/projection-holding.test.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/projection/projection-holding.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/config-roots/projection-slices.test.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/config-roots/projection-slices.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/projection/projection-text.test.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/projection/projection-text.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/runner.test.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/runner.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/config-roots/sliced-projection.test.ts": expect.any(String),
      "./src/infrastructure/engines/eslint/runner/config-roots/sliced-projection.ts": expect.any(String),
    });
  });

  it("finds every other runner file and its test, shared files included, importing no version 1-only runner file, so the dependency points old to new only", () => {
    expect({
      scanned: versionTwoRunnerSources,
      importsOutside: importsOutside({ sources: versionTwoRunnerSources, allowed: [reachesNoVersionOneOnlyRunnerFile, packageOrComputedImport] }),
    }).toEqual({
      scanned: expect.objectContaining({
        "./src/infrastructure/engines/eslint/runner/checks-runner/checks-runner.ts": expect.any(String),
        "./src/infrastructure/engines/eslint/runner/lint-findings/misnamed-rule-ids.ts": expect.any(String),
        "./src/infrastructure/engines/eslint/runner/projection/projection.ts": expect.any(String),
      }),
      importsOutside: [],
    });
  });
});

describe("the test-import confinement check's own file, which its glob cannot include, read here as a build-time raw module (CD-47: that source is the assertion's subject; nothing is spawned or written)", () => {
  it("finds src/infrastructure/engines/protocol/confinement/vendor-imports.test.ts importing only relative paths and vitest, type-only imports included", () => {
    expect({
      scanned: vendorImportsTestSources,
      importsOutside: importsOutside({
        sources: vendorImportsTestSources,
        allowed: [relativeImportOfAnyForm, vitestImport],
      }),
    }).toEqual({ scanned: { "./src/infrastructure/engines/protocol/confinement/vendor-imports.test.ts": expect.any(String) }, importsOutside: [] });
  });
});
