import { describe, expect, it } from "vitest";
import { importsOutsideFromOwnFolder, importStatementsReaching, packageOrComputedImport, relativeImportReaching } from "../../tests/confinement.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const versionTwoSources = import.meta.glob(["./core/settings/**/*.ts", "./core/run/**/*.ts", "./core/command-line/**/*.ts", "./core/conformance/**/*.ts", "./core/records/**/*.ts", "./core/report/**/*.ts", "./core/touched-set/**/*.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const reachingNothingInTheVersionOneReaders = ({ importingFolder }: { readonly importingFolder: string }) => [
  relativeImportReaching({ importingFolder, reach: /^(?!core\/(?:consumer-selection|exception-records|upgrade)\/)/ }),
  packageOrComputedImport,
];

describe("what version 2 takes from the version 1 readers, over what this repository's own source imports, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("reads a known file, so the scan is not silently empty", () => {
    expect(versionTwoSources).toEqual(expect.objectContaining({ "./core/settings/read-settings.ts": expect.any(String) }));
  });

  it("finds core/settings, core/run, core/command-line, core/conformance, core/records, core/report and core/touched-set taking from core/consumer-selection, core/exception-records and core/upgrade only what is listed here, so the list can only shrink", () => {
    expect(importsOutsideFromOwnFolder({ sources: versionTwoSources, allowedFrom: reachingNothingInTheVersionOneReaders })).toEqual([
      { file: "./core/run/mechanism-dispatch.test.ts", specifier: "../upgrade/version-one-records/exception-records.ts", form: "type-only" },
      { file: "./core/run/mechanism-dispatch.ts", specifier: "../upgrade/version-one-records/exception-records.ts", form: "type-only" },
      { file: "./core/run/version-chosen-command.test.ts", specifier: "../upgrade/version-one-records/exception-records.ts", form: "type-only" },
      { file: "./core/run/version-two-check-command.test.ts", specifier: "../upgrade/version-one-records/exception-records.ts", form: "type-only" },
    ]);
  });

  it("finds each of those imports naming only what is listed here, so a new name on an existing import fails", () => {
    expect(importStatementsReaching({ sources: versionTwoSources, specifier: /\/(?:consumer-selection|exception-records|upgrade)\// })).toEqual([
      { file: "./core/run/mechanism-dispatch.test.ts", statement: 'import type { ExceptionRecord } from "../upgrade/version-one-records/exception-records.ts";' },
      { file: "./core/run/mechanism-dispatch.ts", statement: 'import type { ExceptionRecord } from "../upgrade/version-one-records/exception-records.ts";' },
      { file: "./core/run/version-chosen-command.test.ts", statement: 'import type { ExceptionRepositoryOf } from "../upgrade/version-one-records/exception-records.ts";' },
      { file: "./core/run/version-two-check-command.test.ts", statement: 'import type { ExceptionRepositoryOf } from "../upgrade/version-one-records/exception-records.ts";' },
    ]);
  });
});
