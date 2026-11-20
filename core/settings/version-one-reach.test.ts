import { describe, expect, it } from "vitest";
import {
  filesReachingExcept,
  importEdgesLeaving,
  importsOutsideFromOwnFolder,
  importStatementsLeaving,
  importStatementsReaching,
  outsideFiles,
  packageOrComputedImport,
  relativeImportReaching,
  specifierImportsReached,
  unresolvedLoadsReached,
  unscannedEdgesReached,
} from "../../tests/confinement.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const versionTwoSources = import.meta.glob(["./core/settings/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}", "./core/run/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}", "./core/command-line/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}", "./core/conformance/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}", "./core/records/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}", "./core/report/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}", "./core/touched-set/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const everySource = import.meta.glob(["./core/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const versionTwoFolders = /^\.\/core\/(?:settings|run|command-line|conformance|records|report|touched-set)\//;

const versionOne = /^\.\/core\/(?:upgrade|exception-records|consumer-selection|check|verdict)\//;

const leavingVersionTwo = { sources: everySource, startingFrom: versionTwoFolders, notEntering: versionOne, reaching: versionOne };

const frontierEdges = importEdgesLeaving(leavingVersionTwo);

const outsideTheRunImports = /^\.\/core\/run\//;

const reachingNothingInTheVersionOneReaders = ({ importingFolder }: { readonly importingFolder: string }) => [
  relativeImportReaching({ importingFolder, reach: /^(?!core\/(?:consumer-selection|exception-records|upgrade|verdict)\/)/ }),
  packageOrComputedImport,
];

describe("what version 2 takes from the version 1 readers, over what this repository's own source imports, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("reads a known file, so the scan is not silently empty", () => {
    expect(versionTwoSources).toEqual(expect.objectContaining({ "./core/settings/read-settings.ts": expect.any(String) }));
  });

  it("finds core/settings, core/run, core/command-line, core/conformance, core/records, core/report and core/touched-set taking from core/consumer-selection, core/exception-records, core/upgrade and core/verdict only what is listed here, so the list can only shrink", () => {
    expect(importsOutsideFromOwnFolder({ sources: versionTwoSources, allowedFrom: reachingNothingInTheVersionOneReaders })).toEqual([
      { file: "./core/run/version-chosen-command.test.ts", specifier: "../upgrade/version-one-records/exception-records.ts", form: "type-only" },
      { file: "./core/run/version-two-check-command.test.ts", specifier: "../upgrade/version-one-records/exception-records.ts", form: "type-only" },
    ]);
  });

  it("finds each of those imports naming only what is listed here, so a new name on an existing import fails", () => {
    expect(importStatementsReaching({ sources: versionTwoSources, specifier: /\/(?:consumer-selection|exception-records|upgrade|verdict)\// })).toEqual([
      { file: "./core/run/version-chosen-command.test.ts", statement: 'import type { ExceptionRepositoryOf } from "../upgrade/version-one-records/exception-records.ts";' },
      { file: "./core/run/version-two-check-command.test.ts", statement: 'import type { ExceptionRepositoryOf } from "../upgrade/version-one-records/exception-records.ts";' },
    ]);
  });

  it("finds, in what the version 2 folders reach without entering version 1, each import, re-export or dynamic load that resolves into core/upgrade, core/exception-records, core/consumer-selection, core/check or core/verdict, outside core/run (whose own imports are pinned above and in run-imports.test.ts), only as listed here, so the list can only shrink", () => {
    expect(outsideFiles({ held: frontierEdges, files: outsideTheRunImports })).toEqual([]);
  });

  it("finds each of those imports naming only what is listed here, so a new name on an existing import fails", () => {
    expect(outsideFiles({ held: importStatementsLeaving(leavingVersionTwo), files: outsideTheRunImports })).toEqual([]);
  });

  it("finds no file in the version 2 folders reaching version 1 through any chain that does not pass an edge listed above or pinned for core/run", () => {
    expect(
      filesReachingExcept({ sources: everySource, startingFrom: versionTwoFolders, reaching: versionOne, exceptEdges: frontierEdges }),
    ).toEqual([]);
  });

  it("finds, in what core/mechanism-port reaches without entering version 1, each import into version 1 only as listed here, the embedded runner's types that two version 1 tests pin in place until version 1's removal deletes them", () => {
    expect(
      importEdgesLeaving({ sources: everySource, startingFrom: /^\.\/core\/mechanism-port\//, notEntering: versionOne, reaching: versionOne }),
    ).toEqual([
      { file: "./core/mechanism-port/embedded-runner-module-schema.ts", specifier: "../upgrade/version-one-records/exception-records.ts", form: "type-only" },
    ]);
  });

  it("finds no file in the version 2 folders reaching the embedded runner's types or its toolchain-bound builder through any chain that does not pass an edge pinned above", () => {
    expect(
      filesReachingExcept({
        sources: everySource,
        startingFrom: versionTwoFolders,
        reaching: /^\.\/core\/mechanism-port\/(?:embedded-runner-module-schema|toolchain-bound-runner)\.ts$/,
        exceptEdges: frontierEdges,
      }),
    ).toEqual([]);
  });

  it("finds, in what the version 2 folders reach without entering version 1, each dynamic load that no relative path names, as written, only as listed here, so a computed load the graph cannot follow is reviewed and not waved through", () => {
    expect(unresolvedLoadsReached({ sources: everySource, startingFrom: versionTwoFolders, notEntering: versionOne })).toEqual([
      { file: "./core/platform-ports/module-loader-port.ts", specifier: "pathToFileURL(request.path).href", form: "dynamic" },
    ]);
  });

  it("finds, in what the version 2 folders reach without entering version 1, each relative import or load that resolves under core/ to no file this scan reads, only as listed here, so an edge the graph cannot follow is reviewed", () => {
    expect(unscannedEdgesReached({ sources: everySource, startingFrom: versionTwoFolders, notEntering: versionOne, within: /^\.\/core\// })).toEqual([]);
  });

  it("finds, in what the version 2 folders reach without entering version 1, each import or load of node:module or module, only as listed here, so a loader the reader cannot trace is reviewed", () => {
    expect(
      specifierImportsReached({ sources: everySource, startingFrom: versionTwoFolders, notEntering: versionOne, specifier: /^(?:node:)?module$/ }),
    ).toEqual([]);
  });
});
