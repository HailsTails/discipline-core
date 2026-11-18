import { describe, expect, it } from "vitest";
import { helpText, SYNOPSIS } from "./command-help.ts";

const TOOL_HELP = `usage: hone <command> [options]

Checks a repository against the disciplines it selects, applies its recorded exceptions and prints one verdict.

commands:
  check        check the repository against the disciplines it selects and print the report, ending in its verdict
  project      write the native configuration each selected embedded mechanism needs, printing each file as written or unchanged
  record-debt  add a reason-only file carve-out to discipline-exceptions.json for each clause and file the check finds broken, as inherited debt, printing each pair and what was done

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

const RECORD_DEBT_HELP = `usage: hone record-debt --repo <dir> --base-revision <revision> [--leave <path>]...

add a reason-only file carve-out to discipline-exceptions.json for each clause and file the check finds broken, as inherited debt, printing each pair and what was done

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --base-revision <revision>
      the branch's base, the revision the run that assesses decay is given, such as origin/main; a file it does not hold gets no record
  --leave <path>
      a file or folder, relative to --repo, that gets no record because a person records it as an authorised location; give it once for each path
  --help, -h
      print this help

exit codes:
  0  every record needed was written, or none was needed
  2  a load failure: an input could not be loaded, a mechanism failed, the records could not be written, or Hone failed unexpectedly
`;

describe("helpText", () => {
  it("marks a required option without brackets and a repeatable one with a trailing ellipsis", () => {
    expect(helpText({ topic: "record-debt" })).toBe(RECORD_DEBT_HELP);
  });

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
      "\nexit codes:\n  0  the verdict is pass\n  1  the verdict is fail\n  2  a load failure: an input could not be loaded, a mechanism failed, or Hone failed unexpectedly\n",
    );
  });
});

describe("SYNOPSIS", () => {
  it("lists each command's usage, then the tool's own flags", () => {
    expect(SYNOPSIS).toBe(
      "hone check --repo <dir> [--base-revision <revision>] [--report-output <full|failures-only|counts|verdict-only>] [--forfeiture <this-run|elsewhere>]\nhone project --repo <dir>\nhone record-debt --repo <dir> --base-revision <revision> [--leave <path>]...\nhone --help\nhone --version\n",
    );
  });
});
