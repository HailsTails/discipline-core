import { describe, expect, it } from "vitest";
import { RUN_SYNOPSIS, RUN_SUBCOMMANDS, runHelpText } from "./run-help.ts";

describe("the version 2 commands", () => {
  it("are check, project, record-debt, prune-debt and upgrade, with split-records gone", () => {
    expect(RUN_SUBCOMMANDS).toEqual(["check", "project", "record-debt", "prune-debt", "upgrade"]);
  });

  it("print a synopsis of every command's usage", () => {
    expect(RUN_SYNOPSIS).toBe(`hone check --repo <dir> [--base-revision <revision>] [--report-output <full|failures-only|counts|verdict-only>] [--forfeiture <this-run|elsewhere>]
hone project --repo <dir>
hone record-debt --repo <dir> --base-revision <revision> [--leave <path>]...
hone prune-debt --repo <dir> [--base-revision <revision>] [--forfeiture <this-run|elsewhere>]
hone upgrade --repo <dir>
hone --help
hone --version
`);
  });
});

describe("runHelpText", () => {
  it("prints the tool's help with each command's summary", () => {
    expect(runHelpText({ topic: "tool" })).toBe(`usage: hone <command> [options]

Checks a repository against the checks hone.config.json lists, answers its findings by the records in hone-records and prints one verdict.

commands:
  check        check the repository against the checks hone.config.json lists and print the report, ending in its verdict
  project      write the native configuration, hone.<engine>.mjs, for each engine that runs a listed check through one, printing each file as written or unchanged
  record-debt  add debt to hone-records for each symptom and file the check finds, printing each and what was done
  prune-debt   remove from hone-records the debt a run shows is paid, stale or forfeited, printing each debt removed
  upgrade      rewrite version 1 files as version 2: disciplines.json as hone.config.json and the exception records as hone-records, printing each file as written or removed

options:
  --help, -h  print this help; after a command, print that command's help
  --version   print the installed version of @hailstails/hone

run hone <command> --help for a command's options and exit codes
`);
  });

  it("prints a command's options and exit codes in version 2's words", () => {
    expect(runHelpText({ topic: "check" })).toBe(`usage: hone check --repo <dir> [--base-revision <revision>] [--report-output <full|failures-only|counts|verdict-only>] [--forfeiture <this-run|elsewhere>]

check the repository against the checks hone.config.json lists and print the report, ending in its verdict

options:
  --repo <dir>
      the folder that holds hone.config.json, usually the repository root
  --base-revision <revision>
      the revision the change is measured from; without it no debt can be forfeited and no carried record is checked against it
  --report-output <full|failures-only|counts|verdict-only>
      how much of the report to print, over reportOutput in hone.config.json; full when neither is set
  --forfeiture <this-run|elsewhere>
      check debt for forfeiture in this run or leave it to another, over forfeiture in hone.config.json; this-run when neither is set
  --help, -h
      print this help

exit codes:
  0  the verdict is pass
  1  the verdict is fail
  2  a load failure: an input could not be loaded, an engine failed, or Hone failed unexpectedly
`);
  });

  it("prints upgrade's help, the one new command", () => {
    expect(runHelpText({ topic: "upgrade" })).toBe(`usage: hone upgrade --repo <dir>

rewrite version 1 files as version 2: disciplines.json as hone.config.json and the exception records as hone-records, printing each file as written or removed

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root; upgrade writes hone.config.json beside it
  --help, -h
      print this help

exit codes:
  0  every version 1 file was rewritten, or none was found
  2  a load failure: a version 1 file could not be read or a version 2 file written, or Hone failed unexpectedly
`);
  });

  it("prints prune-debt's help with its exit code 0 agreeing with its summary", () => {
    expect(runHelpText({ topic: "prune-debt" })).toBe(`usage: hone prune-debt --repo <dir> [--base-revision <revision>] [--forfeiture <this-run|elsewhere>]

remove from hone-records the debt a run shows is paid, stale or forfeited, printing each debt removed

options:
  --repo <dir>
      the folder that holds hone.config.json, usually the repository root
  --base-revision <revision>
      the revision the change is measured from; without it no debt can be forfeited and no carried record is checked against it
  --forfeiture <this-run|elsewhere>
      check debt for forfeiture in this run or leave it to another, over forfeiture in hone.config.json; this-run when neither is set
  --help, -h
      print this help

exit codes:
  0  every debt the run showed paid, stale or forfeited was removed, or none was shown
  2  a load failure: an input could not be loaded, an engine failed, the records could not be written, or Hone failed unexpectedly
`);
  });});
