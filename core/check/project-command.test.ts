import { describe, expect, it } from "vitest";
import { createPathPort } from "../platform-ports/path-port.ts";
import { projectCommandOf } from "./project-command.ts";

const INSTALLED_ENTRY = "file:///work/shop/node_modules/@hailstails/hone/core/check/tool-command.js";

describe("projectCommandOf", () => {
  it("runs the installed entry file with node, from the directory the check ran in, with the check's own --repo", () => {
    expect(
      projectCommandOf({
        path: createPathPort({ flavour: "posix", workingDirectory: () => "/work/shop" }),
        moduleUrl: INSTALLED_ENTRY,
        repo: ".",
      }),
    ).toEqual({ outcome: "ok", value: "node node_modules/@hailstails/hone/core/check/tool-command.js project --repo ." });
  });

  it("reaches the entry file from a working directory below it", () => {
    expect(
      projectCommandOf({
        path: createPathPort({ flavour: "posix", workingDirectory: () => "/work/shop/packages/web" }),
        moduleUrl: INSTALLED_ENTRY,
        repo: "../..",
      }),
    ).toEqual({
      outcome: "ok",
      value: "node ../../node_modules/@hailstails/hone/core/check/tool-command.js project --repo ../..",
    });
  });

  it("quotes a --repo holding a space", () => {
    expect(
      projectCommandOf({
        path: createPathPort({ flavour: "posix", workingDirectory: () => "/work/shop" }),
        moduleUrl: INSTALLED_ENTRY,
        repo: "my shop",
      }),
    ).toEqual({
      outcome: "ok",
      value: "node node_modules/@hailstails/hone/core/check/tool-command.js project --repo \"my shop\"",
    });
  });
});

describe("projectCommandOf on Windows and for an entry it cannot locate", () => {
  it("writes the entry with forward slashes on Windows and keeps the --repo as typed", () => {
    expect(
      projectCommandOf({
        path: createPathPort({ flavour: "windows", workingDirectory: () => "C:\\work\\shop" }),
        moduleUrl: "file:///C:/work/shop/node_modules/@hailstails/hone/core/check/tool-command.js",
        repo: ".\\",
      }),
    ).toEqual({ outcome: "ok", value: "node node_modules/@hailstails/hone/core/check/tool-command.js project --repo .\\" });
  });

  it("names the entry by its absolute path when it sits on another drive", () => {
    expect(
      projectCommandOf({
        path: createPathPort({ flavour: "windows", workingDirectory: () => "D:\\shop" }),
        moduleUrl: "file:///C:/tools/node_modules/@hailstails/hone/core/check/tool-command.js",
        repo: ".",
      }),
    ).toEqual({ outcome: "ok", value: "node C:\\tools\\node_modules\\@hailstails\\hone\\core\\check\\tool-command.js project --repo ." });
  });

  it("fails as install-root-unresolvable when the module URL is not a file URL", () => {
    expect(
      projectCommandOf({
        path: createPathPort({ flavour: "posix", workingDirectory: () => "/work/shop" }),
        moduleUrl: "https://example.com/tool-command.js",
        repo: ".",
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "install-root-unresolvable", url: "https://example.com/tool-command.js" } });
  });
});
