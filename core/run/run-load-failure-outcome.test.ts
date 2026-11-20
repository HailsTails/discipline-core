import { describe, expect, it } from "vitest";
import { runLoadFailureOutcomeOf } from "./run-load-failure-outcome.ts";

describe("runLoadFailureOutcomeOf", () => {
  it("prints the load failure as one line and exits 2, whatever the failure", () => {
    expect(runLoadFailureOutcomeOf({ failure: { kind: "config-absent", repo: "/repo" } })).toEqual({
      code: 2,
      text: "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root\n",
    });
  });

  it("promises no upgrade command, since the line it prints for a version 1 file says none rewrites it yet", () => {
    expect(runLoadFailureOutcomeOf({ failure: { kind: "upgrade-needed", path: "disciplines.json" } })).toEqual({
      code: 2,
      text: "load failure: upgrade-needed disciplines.json: this is a version 1 file, and this release has no command that rewrites it yet; keep running this repository on version 1 files\n",
    });
  });
});
