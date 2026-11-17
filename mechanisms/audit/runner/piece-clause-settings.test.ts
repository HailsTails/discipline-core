import { describe, expect, it } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-types.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { stringListClauseSettings } from "./piece-clause-settings.ts";

const clauseWith = (request: { readonly settings: unknown }): RunnerClause => ({
  address: clauseAddressSchema.parse("CD-19#import-boundaries"),
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-19",
  settings: request.settings,
});

describe("stringListClauseSettings", () => {
  it("reads each named string list from the clauseSettings", () => {
    expect(
      stringListClauseSettings({
        clause: clauseWith({ settings: { module: "a.ts", clauseSettings: { allowed: ["x"], denied: [] } } }),
        keys: ["allowed", "denied"],
      }),
    ).toEqual({ outcome: "ok", value: { allowed: ["x"], denied: [] } });
  });

  it.each([
    { name: "absent", settings: { module: "a.ts" } },
    { name: "missing a named list", settings: { module: "a.ts", clauseSettings: { allowed: [] } } },
    { name: "holding an unnamed setting", settings: { module: "a.ts", clauseSettings: { allowed: [], denied: [], extra: [] } } },
    { name: "holding a list that is not of strings", settings: { module: "a.ts", clauseSettings: { allowed: [1], denied: [] } } },
    { name: "holding an empty string", settings: { module: "a.ts", clauseSettings: { allowed: [""], denied: [] } } },
  ])("is piece-invalid, naming the clause, when the clauseSettings are $name", ({ settings }) => {
    expect(stringListClauseSettings({ clause: clauseWith({ settings }), keys: ["allowed", "denied"] })).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: "/install/mechanisms/audit/CD-19",
        detail: expect.stringContaining("the clauseSettings of CD-19#import-boundaries are malformed"),
      },
    });
  });
});
