import { describe, expect, it } from "vitest";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { readEslintProjection } from "./consumer-selection.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const selectionText = (text: string): FileTextPort => ({
  read: () => ({ outcome: "ok", value: text }),
  exists: () => "present",
  write: () => ({ outcome: "ok", value: undefined }),
});

const projectionIn = (text: string) => readEslintProjection({ fileText: selectionText(text), path: posixPath, repoRoot: REPO_ROOT });

describe("readEslintProjection", () => {
  it("is javascript when disciplines.json names no projection", () => {
    expect(projectionIn('{ "version": 1, "ruleSets": {}, "clauses": {} }')).toEqual({ outcome: "ok", value: "javascript" });
  });

  it.each(["javascript", "typescript"])("reads the projection %s that disciplines.json chooses", (eslintProjection) => {
    expect(projectionIn(`{ "version": 1, "ruleSets": {}, "clauses": {}, "eslintProjection": "${eslintProjection}" }`)).toEqual({
      outcome: "ok",
      value: eslintProjection,
    });
  });

  it("is file-malformed when disciplines.json chooses a projection that is neither javascript nor typescript", () => {
    expect(projectionIn('{ "version": 1, "ruleSets": {}, "clauses": {}, "eslintProjection": "ts" }')).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: "/repo/disciplines.json" },
    });
  });
});
