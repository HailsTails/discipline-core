import { describe, expect, it } from "vitest";
import { createPathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { projectCommandOf } from "./project-command.ts";

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/work/shop/packages/web" });

const INSTALLED_ENTRY = "file:///work/shop/node_modules/@hailstails/hone/core/check/tool-command.js";

describe("projectCommandOf", () => {
  it("runs the installed entry file with node by its absolute path, with the repository root the check measured", () => {
    expect(
      projectCommandOf({ path: POSIX_PATH, moduleUrl: INSTALLED_ENTRY, repoRoot: absolutePathSchema.parse("/work/shop") }),
    ).toEqual({
      outcome: "ok",
      value: "node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js project --repo /work/shop",
    });
  });

  it("quotes a path holding a space", () => {
    expect(
      projectCommandOf({ path: POSIX_PATH, moduleUrl: INSTALLED_ENTRY, repoRoot: absolutePathSchema.parse("/work/my shop") }),
    ).toEqual({
      outcome: "ok",
      value: "node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js project --repo \"/work/my shop\"",
    });
  });

  it("writes Windows paths with forward slashes", () => {
    expect(
      projectCommandOf({
        path: createPathPort({ flavour: "windows", workingDirectory: () => "D:\\elsewhere" }),
        moduleUrl: "file:///C:/work/shop/node_modules/@hailstails/hone/core/check/tool-command.js",
        repoRoot: absolutePathSchema.parse("C:\\work\\shop"),
      }),
    ).toEqual({
      outcome: "ok",
      value: "node C:/work/shop/node_modules/@hailstails/hone/core/check/tool-command.js project --repo C:/work/shop",
    });
  });

  it("fails as install-root-unresolvable when the module URL is not a file URL", () => {
    expect(
      projectCommandOf({
        path: POSIX_PATH,
        moduleUrl: "https://example.com/tool-command.js",
        repoRoot: absolutePathSchema.parse("/work/shop"),
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "install-root-unresolvable", url: "https://example.com/tool-command.js" } });
  });
});
