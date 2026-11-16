import { describe, expect, it } from "vitest";
import { dependencyNamesOf, packageVersionOf, peerNamesOf, publishManifestOf } from "./published-manifest.ts";

const DEVELOPMENT_MANIFEST = {
  version: "0.0.0",
  private: true,
  type: "module",
  description: "Runs disciplines.",
  license: "MIT-0",
  engines: { node: ">=22.18.0" },
  scripts: { test: "vitest run" },
  dependencies: { zod: "4.4.3" },
  peerDependencies: { eslint: "^9.12.0 || ^10.0.0", typescript: ">=4.8.4 <7.0.0" },
  peerDependenciesMeta: { eslint: { optional: true } },
  devDependencies: { vitest: "4.1.11" },
};

describe("publishManifestOf", () => {
  const published = (developmentManifest: string) =>
    publishManifestOf({
      developmentManifest,
      identity: {
        name: "Provisional",
        packageName: "provisional-core",
        reservedEslintNamespace: "provisional-core",
        command: "provisional",
        description: "Checks a repository against its disciplines.",
        repository: "https://github.com/example/provisional",
        unrelatedNpmPackage: "provisional",
      },
      command: "core/check/tool-command.js",
      files: ["LICENSE", "chunks", "core", "mechanisms"],
      exported: ["mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js"],
      nodeRange: "^22.13.0 || >=24",
    });

  it("names and describes the package for consumers, links its repository, home page and issues so npm trusted publishing can match the repository, publishes publicly so a scoped name is not restricted, names its one command, exposes only its manifest and the modules a projection imports, and carries the optional peers but no dependencies", () => {
    expect(published(JSON.stringify(DEVELOPMENT_MANIFEST))).toEqual({
      outcome: "ok",
      value: `${JSON.stringify(
        {
          name: "provisional-core",
          version: "0.0.0",
          description: "Checks a repository against its disciplines.",
          license: "MIT-0",
          repository: { type: "git", url: "git+https://github.com/example/provisional.git" },
          homepage: "https://github.com/example/provisional#readme",
          bugs: { url: "https://github.com/example/provisional/issues" },
          publishConfig: { access: "public" },
          type: "module",
          bin: { provisional: "core/check/tool-command.js" },
          exports: {
            "./package.json": "./package.json",
            "./mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js": "./mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js",
          },
          files: ["LICENSE", "chunks", "core", "mechanisms"],
          engines: { node: "^22.13.0 || >=24" },
          peerDependencies: { eslint: "^9.12.0 || ^10.0.0", typescript: ">=4.8.4 <7.0.0" },
          peerDependenciesMeta: { eslint: { optional: true } },
        },
        null,
        2,
      )}\n`,
    });
  });

  it("names the development manifest invalid when it lacks the peers", () => {
    const { peerDependencies: _peers, ...withoutPeers } = DEVELOPMENT_MANIFEST;
    expect(published(JSON.stringify(withoutPeers))).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });

  it("names the development manifest invalid when it is not JSON", () => {
    expect(published("{")).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });
});

describe("peerNamesOf", () => {
  it("names each declared peer", () => {
    expect(peerNamesOf({ developmentManifest: JSON.stringify(DEVELOPMENT_MANIFEST) })).toEqual({ outcome: "ok", value: ["eslint", "typescript"] });
  });

  it("names the development manifest invalid when it declares no peers", () => {
    expect(peerNamesOf({ developmentManifest: "{}" })).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });
});

describe("dependencyNamesOf", () => {
  it("names each runtime dependency, leaving out development ones", () => {
    expect(dependencyNamesOf({ developmentManifest: JSON.stringify(DEVELOPMENT_MANIFEST) })).toEqual({ outcome: "ok", value: ["zod"] });
  });

  it("names the development manifest invalid when it declares no dependencies", () => {
    expect(dependencyNamesOf({ developmentManifest: "{}" })).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });
});

describe("packageVersionOf", () => {
  it("reads the version the package is built at", () => {
    expect(packageVersionOf({ developmentManifest: JSON.stringify(DEVELOPMENT_MANIFEST) })).toEqual({ outcome: "ok", value: "0.0.0" });
  });

  it("names the development manifest invalid when it declares no version", () => {
    expect(packageVersionOf({ developmentManifest: "{}" })).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });
});