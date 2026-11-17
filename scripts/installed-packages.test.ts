import { describe, expect, it } from "vitest";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import { inMemoryFiles } from "../tests/in-memory-files.ts";
import { installedPackagesOf } from "./installed-packages.ts";
import type { ClosureMember } from "./pnpm-lock.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const CLOSURE: readonly ClosureMember[] = [
  { name: "zod", version: "4.4.3", requires: [] },
  {
    name: "@eslint/plugin-kit",
    version: "0.7.3",
    requires: [
      { name: "@eslint/core", kind: "required" },
      { name: "levn", kind: "required" },
      { name: "type-check", kind: "optional" },
    ],
  },
  { name: "@eslint/core", version: "1.2.1", requires: [] },
  { name: "levn", version: "0.4.1", requires: [] },
  { name: "type-check", version: "0.4.0", requires: [] },
];

const DIRECT = ["zod", "@eslint/plugin-kit"];

const STORE_FILES: Readonly<Record<string, string>> = {
  "/store/zod@4.4.3/node_modules/zod/package.json": "{}",
  "/store/kit/node_modules/@eslint/plugin-kit/package.json": "{}",
  "/store/core/node_modules/@eslint/core/package.json": "{}",
  "/store/levn/node_modules/levn/package.json": "{}",
};

const LINKS: Readonly<Record<string, string>> = {
  "/repo/node_modules/zod": "/store/zod@4.4.3/node_modules/zod",
  "/repo/node_modules/@eslint/plugin-kit": "/store/kit/node_modules/@eslint/plugin-kit",
  "/store/kit/node_modules/@eslint/core": "/store/core/node_modules/@eslint/core",
  "/store/kit/node_modules/levn": "/store/levn/node_modules/levn",
};

const WITHOUT_LEVN_LINK: Readonly<Record<string, string>> = {
  "/repo/node_modules/zod": "/store/zod@4.4.3/node_modules/zod",
  "/repo/node_modules/@eslint/plugin-kit": "/store/kit/node_modules/@eslint/plugin-kit",
  "/store/kit/node_modules/@eslint/core": "/store/core/node_modules/@eslint/core",
};

const WITH_IS_GLOB_LINK: Readonly<Record<string, string>> = { "/repo/node_modules/is-glob": "/store/zod@4.4.3/node_modules/zod" };

const locatedWith = (request: { readonly links: Readonly<Record<string, string>>; readonly direct: readonly string[] }) =>
  installedPackagesOf({
    closure: CLOSURE,
    direct: request.direct,
    nodeModules: "/repo/node_modules",
    path: posixPath,
    scratch: inMemoryFiles({ initial: STORE_FILES, links: request.links }).scratch,
  });

describe("installedPackagesOf", () => {
  it("follows each direct dependency's link, then each requirement from the node_modules beside the package that requires it", () => {
    expect(locatedWith({ links: LINKS, direct: DIRECT })).toEqual({
      outcome: "ok",
      value: [
        { name: "zod", folder: "/store/zod@4.4.3/node_modules/zod" },
        { name: "@eslint/plugin-kit", folder: "/store/kit/node_modules/@eslint/plugin-kit" },
        { name: "@eslint/core", folder: "/store/core/node_modules/@eslint/core" },
        { name: "levn", folder: "/store/levn/node_modules/levn" },
      ],
    });
  });

  it("fails naming a required package whose link is missing", () => {
    expect(locatedWith({ links: WITHOUT_LEVN_LINK, direct: DIRECT })).toEqual({
      outcome: "failed",
      error: "levn is not installed at /store/kit/node_modules/levn: ENOENT /store/kit/node_modules/levn",
    });
  });

  it("fails naming a direct dependency that is not installed", () => {
    expect(locatedWith({ links: {}, direct: ["levn"] })).toEqual({
      outcome: "failed",
      error: "levn is not installed at /repo/node_modules/levn: ENOENT /repo/node_modules/levn",
    });
  });

  it("fails naming an installed package outside the closure", () => {
    expect(locatedWith({ links: WITH_IS_GLOB_LINK, direct: ["is-glob"] })).toEqual({
      outcome: "failed",
      error: "is-glob is installed at /repo/node_modules/is-glob but is not in the closure of core's dependencies",
    });
  });
});
