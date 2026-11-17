import { describe, expect, it } from "vitest";
import { argumentProblemText } from "./argument-problem.ts";
import { parseCheckArguments, parseInvocation, parseProjectArguments } from "./command-arguments.ts";
import { FORFEITURE_OPTION, REPO_OPTION, REPORT_OUTPUT_OPTION } from "./command-line.ts";

const invalid = (request: { readonly detail: string }) => ({
  outcome: "failed",
  error: { kind: "arguments-invalid", detail: request.detail },
});

describe("parseInvocation", () => {
  it.each([
    { given: ["check", "--repo", "/work/repo"], expected: { kind: "run", subcommand: "check", arguments: ["--repo", "/work/repo"] } },
    { given: ["project", "--repo", "/work/repo"], expected: { kind: "run", subcommand: "project", arguments: ["--repo", "/work/repo"] } },
    { given: ["--help"], expected: { kind: "help", topic: "tool" } },
    { given: ["-h"], expected: { kind: "help", topic: "tool" } },
    { given: ["--version"], expected: { kind: "version" } },
    { given: ["check", "--help"], expected: { kind: "help", topic: "check" } },
    { given: ["project", "--repo", "/work/repo", "-h"], expected: { kind: "help", topic: "project" } },
    { given: ["--help", "check"], expected: { kind: "help", topic: "check" } },
    { given: ["check", "--", "--help"], expected: { kind: "help", topic: "check" } },
    { given: ["check", "--repo", "/work/repo", "--", "-h"], expected: { kind: "help", topic: "check" } },
  ])("reads $given", ({ given, expected }) => {
    expect(parseInvocation({ arguments: given })).toEqual({ outcome: "ok", value: expected });
  });

  it.each([
    { given: [], problem: { kind: "command-missing" } },
    { given: ["lint", "--repo", "/work/repo"], problem: { kind: "command-unknown", given: "lint" } },
    { given: ["--repo", "/work/repo", "check"], problem: { kind: "command-unknown", given: "--repo" } },
    { given: ["--version", "extra"], problem: { kind: "flag-extra", flag: "--version", given: "extra" } },
    { given: ["--help", "lint"], problem: { kind: "flag-extra", flag: "--help", given: "lint" } },
  ] as const)("is arguments-invalid for $given", ({ given, problem }) => {
    expect(parseInvocation({ arguments: given })).toEqual(invalid({ detail: argumentProblemText({ problem }) }));
  });
});

describe("parseCheckArguments", () => {
  it.each([
    { given: ["--repo", "/work/repo"], expected: { repo: "/work/repo" } },
    { given: ["--base-revision", "origin/main", "--repo", "/work/repo"], expected: { repo: "/work/repo", baseRevision: "origin/main" } },
    { given: ["--repo", "/work/repo", "--report-output", "counts"], expected: { repo: "/work/repo", reportOutput: "counts" } },
    { given: ["--repo", "/work/repo", "--forfeiture", "elsewhere"], expected: { repo: "/work/repo", forfeiture: "elsewhere" } },
    { given: ["--repo", "/work/repo", "--", "--base-revision", "origin/main"], expected: { repo: "/work/repo", baseRevision: "origin/main" } },
    { given: ["--", "--repo", "/work/repo"], expected: { repo: "/work/repo" } },
    { given: ["--repo", "/work/repo", "--"], expected: { repo: "/work/repo" } },
  ])("reads $given", ({ given, expected }) => {
    expect(parseCheckArguments({ arguments: given })).toEqual({
      outcome: "ok",
      value: { baseRevision: undefined, reportOutput: undefined, forfeiture: undefined, ...expected },
    });
  });
});

describe("parseCheckArguments refusing what it cannot read", () => {
  it.each([
    { given: [], problem: { kind: "option-required", subcommand: "check", option: REPO_OPTION } },
    { given: ["--repo"], problem: { kind: "value-missing", option: REPO_OPTION } },
    { given: ["--repo", "--report-output", "full"], problem: { kind: "value-missing", option: REPO_OPTION } },
    { given: ["--repo", "/work/repo", "--fix"], problem: { kind: "option-unknown", subcommand: "check", given: "--fix" } },
    { given: ["--repo", "/work/repo", "-x"], problem: { kind: "option-unknown", subcommand: "check", given: "-x" } },
    { given: ["--repo", "-h"], problem: { kind: "value-missing", option: REPO_OPTION } },
    { given: ["--repo", "/work/repo", "src"], problem: { kind: "argument-unexpected", subcommand: "check", given: "src" } },
    { given: ["--repo", "/work/repo", "--", "src"], problem: { kind: "argument-unexpected", subcommand: "check", given: "src" } },
    { given: ["--repo", "--"], problem: { kind: "value-missing", option: REPO_OPTION } },
    { given: ["--repo", "--", "/work/repo"], problem: { kind: "value-missing", option: REPO_OPTION } },
    { given: ["--repo=/work/repo"], problem: { kind: "option-joined", option: REPO_OPTION, given: "--repo=/work/repo" } },
    { given: ["--repo", "/a", "--repo", "/b"], problem: { kind: "option-repeated", option: REPO_OPTION } },
    {
      given: ["--repo", "/work/repo", "--report-output", "summary"],
      problem: { kind: "choice-invalid", option: REPORT_OUTPUT_OPTION, choices: ["full", "failures-only", "counts", "verdict-only"], given: "summary" },
    },
    {
      given: ["--repo", "/work/repo", "--forfeiture", "reported"],
      problem: { kind: "choice-invalid", option: FORFEITURE_OPTION, choices: ["this-run", "elsewhere"], given: "reported" },
    },
  ] as const)("is arguments-invalid for $given", ({ given, problem }) => {
    expect(parseCheckArguments({ arguments: given })).toEqual(invalid({ detail: argumentProblemText({ problem }) }));
  });

  it.each([
    { given: ["--repo", "/work/repo", "--waived-clauses", "not-run"] },
    { given: ["--waived-clauses", "run", "--repo", "/work/repo"] },
  ])("names the removed --waived-clauses and what replaces it, given $given", ({ given }) => {
    expect(parseCheckArguments({ arguments: given })).toEqual(
      invalid({
        detail:
          'removed: "--waived-clauses"; in clauses, mark a clause "not-run" when its mechanism does not run, or "not-adopted" when its rule does not apply; see MIGRATING.md section 12',
      }),
    );
  });
});

describe("parseProjectArguments", () => {
  it.each([{ given: ["--repo", "/work/repo"] }, { given: ["--", "--repo", "/work/repo"] }])("reads --repo from $given", ({ given }) => {
    expect(parseProjectArguments({ arguments: given })).toEqual({ outcome: "ok", value: { repo: "/work/repo" } });
  });

  it.each([
    { given: [], problem: { kind: "option-required", subcommand: "project", option: REPO_OPTION } },
    { given: ["--repo", "/work/repo", "--base-revision", "main"], problem: { kind: "option-unknown", subcommand: "project", given: "--base-revision" } },
  ] as const)("is arguments-invalid for $given", ({ given, problem }) => {
    expect(parseProjectArguments({ arguments: given })).toEqual(invalid({ detail: argumentProblemText({ problem }) }));
  });
});
