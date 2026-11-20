import { describe, expect, it } from "vitest";
import { filesNotMatching, importsOutsideFromOwnFolder, packageOrComputedImport, relativeImportReaching } from "../../tests/confinement.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const runSources = import.meta.glob(["./core/run/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const commandRequestImporters = import.meta.glob(
  [
    "./core/run/version-chosen-command.ts",
    "./core/run/version-chosen-command.test.ts",
    "./core/run/version-two-check-command.ts",
    "./core/run/version-two-check-command.test.ts",
    "./core/run/version-two-needed-command.ts",
    "./core/run/version-two-record-commands.ts",
    "./core/run/version-two-repository.ts",
  ],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const reachingNothingUnderCheck = ({ importingFolder }: { readonly importingFolder: string }) => [
  relativeImportReaching({ importingFolder, reach: /^(?!core\/check\/)/ }),
  packageOrComputedImport,
];

describe("the version 2 run's reach into core, over what this repository's own run source imports, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("reads a known file, so the scan is not silently empty", () => {
    expect(runSources).toEqual(expect.objectContaining({ "./core/run/version-two-run.ts": expect.any(String) }));
  });

  it("finds core/run importing from core/check only the CommandRequest type, in these seven files, until the version 1 removal moves it", () => {
    expect(importsOutsideFromOwnFolder({ sources: runSources, allowedFrom: reachingNothingUnderCheck })).toEqual([
      { file: "./core/run/version-chosen-command.test.ts", specifier: "../check/run-check-command.ts", form: "type-only" },
      { file: "./core/run/version-chosen-command.ts", specifier: "../check/run-check-command.ts", form: "type-only" },
      { file: "./core/run/version-two-check-command.test.ts", specifier: "../check/run-check-command.ts", form: "type-only" },
      { file: "./core/run/version-two-check-command.ts", specifier: "../check/run-check-command.ts", form: "type-only" },
      { file: "./core/run/version-two-needed-command.ts", specifier: "../check/run-check-command.ts", form: "type-only" },
      { file: "./core/run/version-two-record-commands.ts", specifier: "../check/run-check-command.ts", form: "type-only" },
      { file: "./core/run/version-two-repository.ts", specifier: "../check/run-check-command.ts", form: "type-only" },
    ]);
  });

  it("finds each of those seven imports naming only CommandRequest", () => {
    expect(filesNotMatching({ sources: commandRequestImporters, pattern: /import type \{ CommandRequest \} from "\.\.\/check\/run-check-command\.ts";/ })).toEqual([]);
  });
});
