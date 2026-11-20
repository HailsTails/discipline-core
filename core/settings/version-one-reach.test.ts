import { describe, expect, it } from "vitest";
import { importsOutsideFromOwnFolder, packageOrComputedImport, relativeImportReaching } from "../../tests/confinement.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const versionTwoSources = import.meta.glob(["./core/settings/**/*.ts", "./core/run/**/*.ts", "./core/command-line/**/*.ts", "./core/conformance/**/*.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const reachingNothingInTheVersionOneReaders = ({ importingFolder }: { readonly importingFolder: string }) => [
  relativeImportReaching({ importingFolder, reach: /^(?!core\/(?:consumer-selection|exception-records)\/)/ }),
  packageOrComputedImport,
];

describe("what version 2 takes from the version 1 readers, over what this repository's own source imports, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("reads a known file, so the scan is not silently empty", () => {
    expect(versionTwoSources).toEqual(expect.objectContaining({ "./core/settings/read-settings.ts": expect.any(String) }));
  });

  it("finds core/settings, core/run, core/command-line and core/conformance taking from core/consumer-selection and core/exception-records only what is listed here, so the list can only shrink", () => {
    expect(importsOutsideFromOwnFolder({ sources: versionTwoSources, allowedFrom: reachingNothingInTheVersionOneReaders })).toEqual([
      { file: "./core/command-line/command-outcome.ts", specifier: "../exception-records/debt-pair.ts", form: "type-only" },
      { file: "./core/command-line/command-outcome.ts", specifier: "../exception-records/exception-records.ts", form: "type-only" },
      { file: "./core/command-line/command-outcome.ts", specifier: "../exception-records/inherited-debt.ts", form: "type-only" },
      { file: "./core/run/mechanism-dispatch.test.ts", specifier: "../exception-records/exception-records.ts", form: "type-only" },
      { file: "./core/run/mechanism-dispatch.ts", specifier: "../exception-records/exception-records.ts", form: "type-only" },
      { file: "./core/run/version-chosen-command.test.ts", specifier: "../exception-records/exception-records.ts", form: "type-only" },
      { file: "./core/run/version-two-check-command.test.ts", specifier: "../exception-records/exception-records.ts", form: "type-only" },
    ]);
  });
});
