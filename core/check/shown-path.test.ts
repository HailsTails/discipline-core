import { describe, expect, it } from "vitest";
import { createPathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { shownFailureOf, shownPathOf } from "./shown-path.ts";

const WINDOWS = createPathPort({ flavour: "windows", workingDirectory: () => "C:\\work" });

const REPO_ROOT = absolutePathSchema.parse("C:\\work\\my repo");

describe("shownPathOf", () => {
  it.each([
    { target: "C:\\work\\my repo\\disciplines.json", shown: "disciplines.json" },
    {
      target: "C:\\work\\my repo\\node_modules\\@hailstails\\hone\\rules\\CD-15\\README.md",
      shown: "node_modules/@hailstails/hone/rules/CD-15/README.md",
    },
    { target: "C:\\work\\shared\\rules\\TM-1\\discipline.json", shown: "../shared/rules/TM-1/discipline.json" },
    { target: "D:\\hone\\package.json", shown: "D:/hone/package.json" },
  ])("shows $target as $shown", ({ target, shown }) => {
    expect(shownPathOf({ path: WINDOWS, repoRoot: REPO_ROOT, target })).toBe(shown);
  });

  it("shows a path with forward slashes when there is no repository folder yet", () => {
    expect(shownPathOf({ path: WINDOWS, repoRoot: undefined, target: "C:\\hone\\package.json" })).toBe("C:/hone/package.json");
  });
});

describe("shownFailureOf", () => {
  it.each([
    {
      failure: { kind: "file-malformed", path: "C:\\work\\my repo\\disciplines.json", detail: "x" },
      shown: { kind: "file-malformed", path: "disciplines.json", detail: "x" },
    },
    {
      failure: { kind: "unsupported-version", path: "C:\\work\\my repo\\discipline-exceptions.json", found: 2 },
      shown: { kind: "unsupported-version", path: "discipline-exceptions.json", found: 2 },
    },
    {
      failure: { kind: "rule-set-invalid", path: "C:\\work\\my repo\\team\\rules\\TM-1\\discipline.json", detail: "x" },
      shown: { kind: "rule-set-invalid", path: "team/rules/TM-1/discipline.json", detail: "x" },
    },
    { failure: { kind: "git-failed", detail: "C:\\work" }, shown: { kind: "git-failed", detail: "C:\\work" } },
  ] as const)("shows the paths of a $failure.kind failure as the report shows paths", ({ failure, shown }) => {
    expect(shownFailureOf({ failure, path: WINDOWS, repoRoot: REPO_ROOT })).toEqual(shown);
  });

  it("shows the paths a runner failure names", () => {
    expect(
      shownFailureOf({
        failure: {
          kind: "runner-failed",
          mechanism: mechanismIdSchema.parse("eslint"),
          failure: {
            kind: "toolchain-shadowed",
            packageName: "eslint",
            location: "C:\\work\\my repo\\node_modules\\@hailstails\\hone\\node_modules\\eslint",
            installRoot: "C:\\work\\my repo\\node_modules\\@hailstails\\hone",
          },
        },
        path: WINDOWS,
        repoRoot: REPO_ROOT,
      }),
    ).toMatchObject({
      failure: { location: "node_modules/@hailstails/hone/node_modules/eslint", installRoot: "node_modules/@hailstails/hone" },
    });
  });

  it("leaves a runner failure's repository path as it is", () => {
    const failure = {
      kind: "runner-failed",
      mechanism: mechanismIdSchema.parse("audit"),
      failure: { kind: "file-unreadable", file: repoPathSchema.parse("src/a.ts"), detail: "EACCES" },
    } as const;

    expect(shownFailureOf({ failure, path: WINDOWS, repoRoot: REPO_ROOT })).toEqual(failure);
  });
});
