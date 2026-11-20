import { describe, expect, it } from "vitest";
import { globExtensionsIn, MODULE_EXTENSIONS } from "./confinement.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const guardSources = import.meta.glob(["./core/settings/version-one-reach.test.ts", "./core/run/run-imports.test.ts"], {
  base: "../",
  query: "?raw",
  import: "default",
  eager: true,
});

describe("the source globs of the version 1 reach guards, over the text of the guards", () => {
  it("reads both guard files, so the scan is not silently empty", () => {
    expect(Object.keys(guardSources)).toEqual(["./core/run/run-imports.test.ts", "./core/settings/version-one-reach.test.ts"]);
  });

  it.each(Object.entries(guardSources))("%s globs every source folder by the one set of module extensions, so a module of another extension is read as a .ts one is", (_file, text) => {
    expect(globExtensionsIn({ text })).toEqual([MODULE_EXTENSIONS]);
  });
});
