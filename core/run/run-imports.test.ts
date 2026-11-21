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

const runSources = import.meta.glob(["./core/run/**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const reachingNothingUnderCheck = ({ importingFolder }: { readonly importingFolder: string }) => [
  relativeImportReaching({ importingFolder, reach: /^(?!core\/check\/)/ }),
  packageOrComputedImport,
];

describe("the version 2 run's reach into core, over what this repository's own run source imports, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("reads a known file, so the scan is not silently empty", () => {
    expect(runSources).toEqual(expect.objectContaining({ "./core/run/version-two-run.ts": expect.any(String) }));
  });

  it("finds core/run importing nothing from core/check", () => {
    expect(importsOutsideFromOwnFolder({ sources: runSources, allowedFrom: reachingNothingUnderCheck })).toEqual([]);
  });
});
