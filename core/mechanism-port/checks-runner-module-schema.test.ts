import { describe, expect, it } from "vitest";
import {
  checksProjectResultSchema,
  checksRunnerModuleSchema,
  checksRunResultSchema,
  isChecksModuleKeySetEqual,
  isChecksRunReportSchemaEqual,
  isMisnamedRuleIdSchemaEqual,
  isNotReadyYetFailureSchemaEqual,
  isProjectedFileSchemaEqual,
} from "./checks-runner-module-schema.ts";

const CLASS_SYNTAX = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };

const REPORT = {
  hits: [{ clause: CLASS_SYNTAX, file: "src/a.ts", anchor: { line: 1, column: 7 }, snippet: "export class A {}", check: "authored-class-or-this#class-keyword" }],
  nativeExceptions: [{ kind: "ignore", check: "authored-class-or-this#class-keyword", clause: CLASS_SYNTAX, file: "src/gen.ts" }],
  measured: [{ clause: CLASS_SYNTAX, file: "src/a.ts" }],
  projection: "current",
  misnamedRuleIds: [{ kind: "version-1-id", ruleId: "hone/no-class-authoring", file: "src/a.ts", line: 2, text: "// eslint-disable-next-line hone/no-class-authoring" }],
};

describe("the checks runner's ties to its module schema", () => {
  it("holds the same key set as the module schema", () => {
    expect(isChecksModuleKeySetEqual).toBe(true);
  });

  it("holds the same report, misnamed rule id, not-ready-yet failure and projected file as the types", () => {
    expect([isChecksRunReportSchemaEqual, isMisnamedRuleIdSchemaEqual, isNotReadyYetFailureSchemaEqual, isProjectedFileSchemaEqual]).toEqual([true, true, true, true]);
  });
});

describe("checksRunnerModuleSchema", () => {
  it("accepts a module exporting the native exception kinds it projects, a run, a conform and a project", () => {
    const module = { projectedKinds: ["config-override", "inline-disable"], run: () => Promise.resolve(undefined), conform: () => Promise.resolve(undefined), project: () => Promise.resolve(undefined) };
    expect(checksRunnerModuleSchema.safeParse(module).success).toBe(true);
  });

  it("rejects a module whose run is not a function", () => {
    expect(checksRunnerModuleSchema.safeParse({ projectedKinds: [], run: "run", conform: () => Promise.resolve(undefined), project: () => Promise.resolve(undefined) }).success).toBe(false);
  });

  it("rejects a module with no conform, at the conform key", () => {
    const module = { projectedKinds: [], run: () => Promise.resolve(undefined), project: () => Promise.resolve(undefined) };
    expect(checksRunnerModuleSchema.safeParse(module)).toMatchObject({ success: false, error: { issues: [{ path: ["conform"] }] } });
  });

  it("rejects a module whose conform is not a function", () => {
    expect(checksRunnerModuleSchema.safeParse({ projectedKinds: [], run: () => Promise.resolve(undefined), conform: "conform", project: () => Promise.resolve(undefined) }).success).toBe(false);
  });

  it("rejects a module with no project, at the project key", () => {
    const module = { projectedKinds: [], run: () => Promise.resolve(undefined), conform: () => Promise.resolve(undefined) };
    expect(checksRunnerModuleSchema.safeParse(module)).toMatchObject({ success: false, error: { issues: [{ path: ["project"] }] } });
  });

  it("rejects a module whose project is not a function", () => {
    expect(checksRunnerModuleSchema.safeParse({ projectedKinds: [], run: () => Promise.resolve(undefined), conform: () => Promise.resolve(undefined), project: "project" }).success).toBe(false);
  });
});

describe("checksProjectResultSchema", () => {
  it("accepts the files to write, keeping every field", () => {
    const projected = { outcome: "ok", value: [{ file: "hone.eslint.mjs", text: "export default [];\n" }] };
    expect(checksProjectResultSchema.safeParse(projected)).toEqual({ success: true, data: projected });
  });

  it("accepts a runner failure", () => {
    const failed = { outcome: "failed", error: { kind: "tool-failed", detail: "disk full" } };
    expect(checksProjectResultSchema.safeParse(failed)).toEqual({ success: true, data: failed });
  });

  it("accepts a not-ready-yet failure", () => {
    const notReady = { outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", cause: "declared-roots", paths: ["packages/web"] } } };
    expect(checksProjectResultSchema.safeParse(notReady)).toEqual({ success: true, data: notReady });
  });

  it("rejects a value that is not a list of files to write", () => {
    expect(checksProjectResultSchema.safeParse({ outcome: "ok", value: "written" }).success).toBe(false);
  });
});

describe("checksRunResultSchema", () => {
  it("accepts a report naming checks and misnamed rule ids, keeping every field", () => {
    expect(checksRunResultSchema.safeParse({ outcome: "ok", value: REPORT })).toEqual({ success: true, data: { outcome: "ok", value: REPORT } });
  });

  it("accepts a runner failure", () => {
    const failed = { outcome: "failed", error: { kind: "tool-failed", detail: "ESLint stopped" } };
    expect(checksRunResultSchema.safeParse(failed)).toEqual({ success: true, data: failed });
  });

  it("accepts the not-ready-yet failure the ESLint runner gives for config roots", () => {
    const failed = { outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", cause: "declared-roots", paths: ["packages/web"] } } };
    expect(checksRunResultSchema.safeParse(failed)).toEqual({ success: true, data: failed });
  });

  it("rejects a not-ready-yet failure that names no path", () => {
    const failed = { outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots", cause: "package-configs", paths: [] } } };
    expect(checksRunResultSchema.safeParse(failed).success).toBe(false);
  });

  it("rejects a misnamed rule id of an unknown kind", () => {
    const report = { ...REPORT, misnamedRuleIds: [{ ...REPORT.misnamedRuleIds[0], kind: "misspelt" }] };
    expect(checksRunResultSchema.safeParse({ outcome: "ok", value: report }).success).toBe(false);
  });

  it("rejects a report that leaves out the misnamed rule ids", () => {
    const { misnamedRuleIds: _left, ...withoutMisnamed } = REPORT;
    expect(checksRunResultSchema.safeParse({ outcome: "ok", value: withoutMisnamed }).success).toBe(false);
  });
});
