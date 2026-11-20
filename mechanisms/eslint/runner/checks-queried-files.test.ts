import { describe, expect, it, vi } from "vitest";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { AnsweredFile } from "./checks-projection.ts";
import { type CheckedFile, projectionEffectOf, queriedFilesOf, queryExceptionsOf } from "./checks-queried-files.ts";
import type { SelectedCheck } from "./checks-run-types.ts";
import type { RuleState } from "./eslint-config-schema.ts";
import type { IgnoredState, QueryInstance } from "./eslint-instance.ts";

const CLAUSE = clauseAddressSchema.parse("CD-1#explicit-any");

const EXPLICIT_ANY: SelectedCheck = { address: "untyped-value#explicit-any", symptom: "untyped-value", ruleId: "hone/untyped-value/explicit-any", clause: CLAUSE, options: [] };

const A = repoPathSchema.parse("src/a.ts");

const B = repoPathSchema.parse("src/b.ts");

const ENFORCED: RuleState = { state: "configured", severity: 2, options: [] };

const OFF: RuleState = { state: "configured", severity: 0, options: [] };

const ABSENT: RuleState = { state: "rule-absent" };

const checkedWith = (request: { readonly file: CheckedFile["file"]; readonly state: RuleState }): CheckedFile => ({
  file: request.file,
  states: [{ ruleId: EXPLICIT_ANY.ruleId, state: request.state }],
});

const ANSWERED_B: readonly AnsweredFile[] = [{ symptom: "untyped-value", file: B }];

type Outcome<Value> = Result<Value, RunnerFailure>;

const ignoredOutcome = (request: { readonly state: IgnoredState }): Outcome<IgnoredState> => ({ outcome: "ok", value: request.state });

describe("queriedFilesOf", () => {
  it("splits the files into ignored ones and checked ones with the state of each selected rule", async () => {
    const query: QueryInstance = {
      ignoredState: vi.fn<QueryInstance["ignoredState"]>().mockResolvedValueOnce(ignoredOutcome({ state: "ignored" })).mockResolvedValueOnce(ignoredOutcome({ state: "checked" })),
      ruleState: vi.fn<QueryInstance["ruleState"]>().mockResolvedValueOnce({ outcome: "ok", value: ENFORCED }),
      configFileOf: vi.fn<QueryInstance["configFileOf"]>(),
    };
    expect(await queriedFilesOf({ query, files: [A, B], ruleIds: [EXPLICIT_ANY.ruleId] })).toEqual({
      outcome: "ok",
      value: { ignored: [A], checked: [checkedWith({ file: B, state: ENFORCED })] },
    });
  });

  it("fails when the query fails", async () => {
    const query: QueryInstance = {
      ignoredState: vi.fn<QueryInstance["ignoredState"]>().mockResolvedValueOnce({ outcome: "failed", error: { kind: "team-config-unloadable", detail: "broken" } }),
      ruleState: vi.fn<QueryInstance["ruleState"]>(),
      configFileOf: vi.fn<QueryInstance["configFileOf"]>(),
    };
    expect(await queriedFilesOf({ query, files: [A], ruleIds: [EXPLICIT_ANY.ruleId] })).toEqual({ outcome: "failed", error: { kind: "team-config-unloadable", detail: "broken" } });
  });
});

describe("queryExceptionsOf", () => {
  it("reports an ignored file as an ignore and a weakened rule as a config override, each naming the check", () => {
    expect(queryExceptionsOf({ selected: [EXPLICIT_ANY], answered: [], queried: { ignored: [A], checked: [checkedWith({ file: B, state: OFF })] } })).toEqual([
      { kind: "ignore", clause: CLAUSE, file: A, check: "untyped-value#explicit-any" },
      { kind: "config-override", clause: CLAUSE, file: B, check: "untyped-value#explicit-any" },
    ]);
  });

  it("does not report as an override the off state of a file the records answer", () => {
    expect(queryExceptionsOf({ selected: [EXPLICIT_ANY], answered: ANSWERED_B, queried: { ignored: [], checked: [checkedWith({ file: B, state: OFF })] } })).toEqual([]);
  });

  it("reports nothing for a rule enforced at severity 2", () => {
    expect(queryExceptionsOf({ selected: [EXPLICIT_ANY], answered: [], queried: { ignored: [], checked: [checkedWith({ file: A, state: ENFORCED })] } })).toEqual([]);
  });
});

describe("projectionEffectOf", () => {
  it("is in effect when every selected rule is configured on a checked file and answered files are off", () => {
    expect(projectionEffectOf({ selected: [EXPLICIT_ANY], answered: ANSWERED_B, queried: { ignored: [], checked: [checkedWith({ file: B, state: OFF })] } })).toBe("in-effect");
  });

  it("is in effect when no file is checked, so nothing says the rule is not enabled", () => {
    expect(projectionEffectOf({ selected: [EXPLICIT_ANY], answered: [], queried: { ignored: [A], checked: [] } })).toBe("in-effect");
  });

  it("is not in effect when a selected rule is absent from every checked file", () => {
    expect(projectionEffectOf({ selected: [EXPLICIT_ANY], answered: [], queried: { ignored: [], checked: [checkedWith({ file: A, state: ABSENT })] } })).toBe("not-in-effect");
  });

  it("is not in effect when an answered file is not turned off", () => {
    expect(projectionEffectOf({ selected: [EXPLICIT_ANY], answered: ANSWERED_B, queried: { ignored: [], checked: [checkedWith({ file: B, state: ENFORCED })] } })).toBe("not-in-effect");
  });
});
