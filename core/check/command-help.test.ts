import { describe, expect, it } from "vitest";
import { helpText } from "./command-help.ts";

const TOOL_HELP = `usage: hone <command> [options]

Checks a repository against the disciplines it selects, applies its recorded exceptions and prints one verdict.

commands:
  check    check the repository against the disciplines it selects and print the report, ending in its verdict
  project  write the native configuration each selected embedded mechanism needs, printing each file as written or unchanged

options:
  --help, -h  print this help; after a command, print that command's help
  --version   print the installed version of @hailstails/hone

run hone <command> --help for a command's options and exit codes
`;

const PROJECT_HELP = `usage: hone project --repo <dir>

write the native configuration each selected embedded mechanism needs, printing each file as written or unchanged

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --help, -h
      print this help

exit codes:
  0  every projection was written or already current
  2  any failure
`;

describe("helpText", () => {
  it("lists the commands and the tool's own options", () => {
    expect(helpText({ topic: "tool" })).toBe(TOOL_HELP);
  });

  it("gives a command its usage line, each option with what it does, and its exit codes", () => {
    expect(helpText({ topic: "project" })).toBe(PROJECT_HELP);
  });

  it("puts each optional check option in brackets on the usage line, with its accepted values", () => {
    expect(helpText({ topic: "check" })).toMatch(
      /^usage: hone check --repo <dir> \[--base-revision <revision>\] \[--report-output <full\|failures-only\|counts\|verdict-only>\] \[--forfeiture <this-run\|elsewhere>\]\n/,
    );
  });

  it("names the check exit codes", () => {
    expect(helpText({ topic: "check" })).toContain(
      "\nexit codes:\n  0  the verdict is pass\n  1  the verdict is fail\n  2  an input could not be loaded, or a mechanism failed or returned invalid output\n",
    );
  });
});
