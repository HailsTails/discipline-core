import { describe, expect, it, vi } from "vitest";
import type { FileRemovalPort } from "../../../core/platform-ports/file-removal-port.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import type { Result } from "../../../core/values/result.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { eslintRepositoryOver } from "./eslint-repository.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" });

const PACKAGE_JSON = repoPathSchema.parse("packages/a/package.json");

const SUPPRESSIONS = repoPathSchema.parse("ci/lint-suppressions.json");

const PACKAGE_A = repoPathSchema.parse("packages/a");

const SLICE = repoPathSchema.parse("packages/a/disciplines.eslint.mjs");

type ReadAnswer = ReturnType<FileTextPort["read"]>;

const fileTextReading = (answer: ReadAnswer) => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue(answer),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const removalAnswering = (answer: Result<void, { readonly kind: "unremovable"; readonly path: string; readonly detail: string }>) => ({
  remove: vi.fn<FileRemovalPort["remove"]>().mockReturnValue(answer),
});

const REMOVED = removalAnswering({ outcome: "ok", value: undefined });

const UNREADABLE: ReadAnswer = { outcome: "failed", error: { kind: "unreadable", path: "/repo/packages/a/package.json", detail: "EACCES" } };

describe("eslintRepositoryOver, package scripts", () => {
  it("reads a package's package.json under the repository root and gives its scripts", () => {
    const fileText = fileTextReading({ outcome: "ok", value: '{ "name": "a", "scripts": { "lint": "eslint ." } }' });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.packageScriptsAt({ packagePath: PACKAGE_JSON })).toEqual({ outcome: "ok", value: { lint: "eslint ." } });
    expect(fileText.read.mock.calls).toEqual([[{ path: "/repo/packages/a/package.json" }]]);
  });

  it("gives no scripts for a package.json without a scripts field", () => {
    const repository = eslintRepositoryOver({
      fileText: fileTextReading({ outcome: "ok", value: '{ "name": "a" }' }),
      fileRemoval: REMOVED,
      path: posixPath,
      repoRoot: REPO_ROOT,
    });
    expect(repository.packageScriptsAt({ packagePath: PACKAGE_JSON })).toEqual({ outcome: "ok", value: {} });
  });

  it("fails as file-unreadable, naming the package.json, when it cannot be read", () => {
    const repository = eslintRepositoryOver({ fileText: fileTextReading(UNREADABLE), fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.packageScriptsAt({ packagePath: PACKAGE_JSON })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "packages/a/package.json", detail: "EACCES" },
    });
  });

  it("fails as tool-failed, naming the package.json, when it is not JSON", () => {
    const repository = eslintRepositoryOver({
      fileText: fileTextReading({ outcome: "ok", value: '{ "scripts": ' }),
      fileRemoval: REMOVED,
      path: posixPath,
      repoRoot: REPO_ROOT,
    });
    expect(repository.packageScriptsAt({ packagePath: PACKAGE_JSON })).toMatchObject({
      outcome: "failed",
      error: { kind: "tool-failed" },
    });
  });
});

describe("eslintRepositoryOver, suppressions", () => {
  it("reads a suppressions file under the repository root and gives its entries", () => {
    const fileText = fileTextReading({ outcome: "ok", value: '{ "src/a.ts": { "hone/no-class-authoring": { "count": 1 } } }' });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.suppressionsAt({ location: SUPPRESSIONS })).toEqual({
      outcome: "ok",
      value: { "src/a.ts": { "hone/no-class-authoring": { count: 1 } } },
    });
    expect(fileText.read.mock.calls).toEqual([[{ path: "/repo/ci/lint-suppressions.json" }]]);
  });

  it("fails as file-unreadable, naming the suppressions file, when it cannot be read", () => {
    const repository = eslintRepositoryOver({ fileText: fileTextReading(UNREADABLE), fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.suppressionsAt({ location: SUPPRESSIONS })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "ci/lint-suppressions.json", detail: "EACCES" },
    });
  });
});

describe("eslintRepositoryOver, a folder's own ESLint config", () => {
  it("asks for every eslint.config name ESLint looks up in the folder, and finds none there unconfigured", () => {
    const fileText = { ...fileTextReading(UNREADABLE), exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent") };
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.folderConfiguration({ folder: PACKAGE_A })).toBe("unconfigured");
    expect(fileText.exists.mock.calls).toEqual([
      [{ path: "/repo/packages/a/eslint.config.js" }],
      [{ path: "/repo/packages/a/eslint.config.mjs" }],
      [{ path: "/repo/packages/a/eslint.config.cjs" }],
      [{ path: "/repo/packages/a/eslint.config.ts" }],
      [{ path: "/repo/packages/a/eslint.config.mts" }],
      [{ path: "/repo/packages/a/eslint.config.cts" }],
    ]);
  });

  it("finds a folder holding any one of those names configured", () => {
    const fileText = {
      ...fileTextReading(UNREADABLE),
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent").mockReturnValueOnce("present").mockReturnValue("absent"),
    };
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.folderConfiguration({ folder: PACKAGE_A })).toBe("configured");
  });
});

describe("eslintRepositoryOver, projection files", () => {
  it("reads a projection under the repository root", () => {
    const fileText = fileTextReading({ outcome: "ok", value: "export default [];\n" });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.projectionFiles.currentAt({ file: SLICE })).toEqual({
      outcome: "ok",
      value: { presence: "present", text: "export default [];\n" },
    });
    expect(fileText.read.mock.calls).toEqual([[{ path: "/repo/packages/a/disciplines.eslint.mjs" }]]);
  });

  it("writes a projection under the repository root when its bytes differ", () => {
    const fileText = fileTextReading({ outcome: "ok", value: "export default [];\n" });
    const repository = eslintRepositoryOver({ fileText, fileRemoval: REMOVED, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.projectionFiles.writeAt({ file: SLICE, text: "export default [{}];\n" })).toEqual({
      outcome: "ok",
      value: { path: "packages/a/disciplines.eslint.mjs", effect: "written" },
    });
    expect(fileText.write.mock.calls).toEqual([[{ path: "/repo/packages/a/disciplines.eslint.mjs", text: "export default [{}];\n" }]]);
  });

  it("removes a projection under the repository root", () => {
    const fileRemoval = removalAnswering({ outcome: "ok", value: undefined });
    const repository = eslintRepositoryOver({ fileText: fileTextReading(UNREADABLE), fileRemoval, path: posixPath, repoRoot: REPO_ROOT });
    expect(repository.projectionFiles.removeAt({ file: SLICE })).toEqual({ outcome: "ok", value: undefined });
    expect(fileRemoval.remove.mock.calls).toEqual([[{ path: "/repo/packages/a/disciplines.eslint.mjs" }]]);
  });

  it("fails as tool-failed with the port's detail when a projection cannot be removed", () => {
    const repository = eslintRepositoryOver({
      fileText: fileTextReading(UNREADABLE),
      fileRemoval: removalAnswering({
        outcome: "failed",
        error: { kind: "unremovable", path: "/repo/packages/a/disciplines.eslint.mjs", detail: "EPERM" },
      }),
      path: posixPath,
      repoRoot: REPO_ROOT,
    });
    expect(repository.projectionFiles.removeAt({ file: SLICE })).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "EPERM" },
    });
  });

  it("reads the projection and a suppressions file at their Windows forms under the repository root", () => {
    const fileText = fileTextReading({ outcome: "ok", value: "{}" });
    const repository = eslintRepositoryOver({
      fileText,
      fileRemoval: REMOVED,
      path: createPathPort({ flavour: "windows", workingDirectory: () => "C:\\repo" }),
      repoRoot: absolutePathSchema.parse("C:\\repo"),
    });
    repository.projectionFiles.currentAt({ file: repoPathSchema.parse("disciplines.eslint.mjs") });
    repository.suppressionsAt({ location: repoPathSchema.parse("src/eslint-suppressions.json") });
    expect(fileText.read.mock.calls).toEqual([
      [{ path: "C:\\repo\\disciplines.eslint.mjs" }],
      [{ path: "C:\\repo\\src\\eslint-suppressions.json" }],
    ]);
  });

  it("writes a package slice at its Windows form under the repository root", () => {
    const fileText = { ...fileTextReading(UNREADABLE), exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent") };
    const repository = eslintRepositoryOver({
      fileText,
      fileRemoval: REMOVED,
      path: createPathPort({ flavour: "windows", workingDirectory: () => "C:\\repo" }),
      repoRoot: absolutePathSchema.parse("C:\\repo"),
    });
    repository.projectionFiles.writeAt({ file: SLICE, text: "export default [];\n" });
    expect(fileText.write.mock.calls).toEqual([[{ path: "C:\\repo\\packages\\a\\disciplines.eslint.mjs", text: "export default [];\n" }]]);
  });
});
