import { describe, expect, it } from "vitest";
import { commandOver, memoryRepositoryOf, recordedProcessWith } from "../../../tests/command-harness.ts";
import type { SettingsFile } from "../../settings/settings-file.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { plannedProjectionOf } from "./planned-projection.ts";

const SETTINGS: SettingsFile = {
  exclude: [],
  ruleSets: [],
  checks: [],
  checkSettings: [],
  forfeiture: "this-run",
  reportOutput: "full",
  checkEditions: "pinned",
  eslintConfigLookup: { lookup: "detected" },
  eslintConfigRoots: [],
  conventions: { conventions: { generated: [], layers: [] }, declared: [] },
};

describe("plannedProjectionOf", () => {
  it("fails with the load failure line when the tool's own symptom catalogue cannot be read", async () => {
    const command = commandOver({ process: recordedProcessWith({ arguments: [] }).port, fileText: memoryRepositoryOf({ files: {} }).fileText });
    const projected = await plannedProjectionOf({ command, repoRoot: absolutePathSchema.parse("/repo"), installRoot: absolutePathSchema.parse("/install") })({
      settings: SETTINGS,
      documents: [],
    });
    expect(projected).toEqual({ outcome: "failed", error: { kind: "projection-failed", detail: "load failure: catalogue-not-read /install/rules/typescript/symptoms.json: the symptom catalogue is missing from this install; reinstall @hailstails/hone" } });
  });
});
