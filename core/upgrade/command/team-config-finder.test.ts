import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../platform-ports/file-text-port.ts";
import { createPathPort } from "../../platform-ports/path-port.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import { teamConfigOf, type TeamConfigRequest } from "./team-config-finder.ts";

const PROJECTION = repoPathSchema.parse("disciplines.eslint.mjs");

const IMPORTING = 'import disciplines from "./disciplines.eslint.mjs";\nexport default [...disciplines];\n';

const UNRELATED = "export default [];\n";

const requestOver = (overrides: Partial<TeamConfigRequest>): TeamConfigRequest => ({
  repoRoot: absolutePathSchema.parse("/repo"),
  fileText: { read: vi.fn<FileTextPort["read"]>() },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  trackedPaths: [],
  projection: PROJECTION,
  ...overrides,
});

const fileTextHolding = (request: { readonly path: string; readonly text: string }): Pick<FileTextPort, "read"> => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
});

describe("teamConfigOf", () => {
  it("finds the one tracked script whose static import resolves to the version 1 projection", () => {
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: IMPORTING })
      .mockReturnValueOnce({ outcome: "ok", value: UNRELATED });
    const request = requestOver({
      trackedPaths: [repoPathSchema.parse("eslint.config.mjs"), repoPathSchema.parse("src/a.ts"), repoPathSchema.parse("disciplines.eslint.mjs"), repoPathSchema.parse("README.md")],
      fileText: { read },
    });
    expect(teamConfigOf(request)).toEqual({ outcome: "ok", value: { file: "eslint.config.mjs", text: IMPORTING } });
    expect(read.mock.calls).toEqual([[{ path: "/repo/eslint.config.mjs" }], [{ path: "/repo/src/a.ts" }]]);
  });

  it("resolves the import relative to the importing file", () => {
    const nested = 'import disciplines from "../disciplines.eslint.mjs";\n';
    const request = requestOver({
      trackedPaths: [repoPathSchema.parse("config/eslint.config.mjs")],
      fileText: fileTextHolding({ path: "/repo/config/eslint.config.mjs", text: nested }),
    });
    expect(teamConfigOf(request)).toEqual({ outcome: "ok", value: { file: "config/eslint.config.mjs", text: nested } });
  });

  it("refuses naming the projection when no tracked script imports it", () => {
    const request = requestOver({
      trackedPaths: [repoPathSchema.parse("eslint.config.mjs")],
      fileText: fileTextHolding({ path: "/repo/eslint.config.mjs", text: UNRELATED }),
    });
    expect(teamConfigOf(request)).toEqual({ outcome: "failed", error: { kind: "no-file-imports-projection", projection: "disciplines.eslint.mjs" } });
  });

  it("refuses naming every script that imports it when there are several", () => {
    const request = requestOver({
      trackedPaths: [repoPathSchema.parse("eslint.config.mjs"), repoPathSchema.parse("lint.config.js")],
      fileText: fileTextHolding({ path: "any", text: IMPORTING }),
    });
    expect(teamConfigOf(request)).toEqual({
      outcome: "failed",
      error: { kind: "several-files-import-projection", projection: "disciplines.eslint.mjs", files: ["eslint.config.mjs", "lint.config.js"] },
    });
  });

  it("refuses when a candidate script cannot be read", () => {
    const request = requestOver({
      trackedPaths: [repoPathSchema.parse("eslint.config.mjs")],
      fileText: { read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/eslint.config.mjs", detail: "ENOENT" } }) },
    });
    expect(teamConfigOf(request)).toEqual({ outcome: "failed", error: { kind: "config-candidate-unreadable", file: "eslint.config.mjs", detail: "ENOENT" } });
  });

  it("reads no script under node_modules", () => {
    const request = requestOver({ trackedPaths: [repoPathSchema.parse("node_modules/x/index.js")] });
    expect(teamConfigOf(request)).toEqual({ outcome: "failed", error: { kind: "no-file-imports-projection", projection: "disciplines.eslint.mjs" } });
    expect(request.fileText.read).not.toHaveBeenCalled();
  });

  it("finds no team config, and reads nothing, when version 1 selected no ESLint projection", () => {
    const request = requestOver({ projection: undefined, trackedPaths: [repoPathSchema.parse("eslint.config.mjs")] });
    expect(teamConfigOf(request)).toEqual({ outcome: "ok", value: undefined });
    expect(request.fileText.read).not.toHaveBeenCalled();
  });
});
