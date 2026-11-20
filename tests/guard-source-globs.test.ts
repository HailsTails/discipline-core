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

const GUARDS = [
  { file: "./core/run/run-imports.test.ts", text: guardSources["./core/run/run-imports.test.ts"] },
  { file: "./core/settings/version-one-reach.test.ts", text: guardSources["./core/settings/version-one-reach.test.ts"] },
];

describe("the source globs of the version 1 reach guards, over the text of the guards", () => {
  it("reads both guard files and no other, so the scan is not silently empty", () => {
    expect(guardSources).toEqual({
      "./core/run/run-imports.test.ts": expect.any(String),
      "./core/settings/version-one-reach.test.ts": expect.any(String),
    });
  });

  it.each(GUARDS)("$file globs every source folder by the one set of module extensions, so a module of another extension is read as a .ts one is", ({ text }) => {
    expect(globExtensionsIn({ text })).toEqual([MODULE_EXTENSIONS]);
  });
});
