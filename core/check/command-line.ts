import type { ExitCode } from "../platform-ports/process-port.ts";
import { RECORD_DEBT_SUBCOMMAND } from "../exception-records/inherited-debt.ts";
import { forfeitureAssessmentSchema } from "../values/assessment.ts";
import { reportOutputSchema } from "../values/report-output.ts";

export const SPLIT_RECORDS_SUBCOMMAND = "split-records";

export const SUBCOMMANDS = ["check", "project", RECORD_DEBT_SUBCOMMAND, SPLIT_RECORDS_SUBCOMMAND] as const;

export type Subcommand = (typeof SUBCOMMANDS)[number];

export type HelpTopic = "tool" | Subcommand;

export type OptionName = "--repo" | "--base-revision" | "--report-output" | "--forfeiture" | "--leave";

export type CommandOption = {
  readonly name: OptionName;
  readonly value: string;
  readonly need: "required" | "optional";
  readonly occurrence: "once" | "repeated";
  readonly summary: string;
};

export type ExitMeaning = {
  readonly code: ExitCode;
  readonly meaning: string;
};

export type CommandSpec = {
  readonly summary: string;
  readonly options: readonly CommandOption[];
  readonly exits: readonly ExitMeaning[];
};

export const HELP_FLAGS: readonly string[] = ["--help", "-h"];

export const VERSION_FLAG = "--version";

const choiceValue = (request: { readonly choices: readonly string[] }): string => `<${request.choices.join("|")}>`;

export const REPO_OPTION: CommandOption = {
  name: "--repo",
  value: "<dir>",
  need: "required",
  occurrence: "once",
  summary: "the folder that holds disciplines.json, usually the repository root",
};

export const BASE_REVISION_OPTION: CommandOption = {
  name: "--base-revision",
  value: "<revision>",
  need: "optional",
  occurrence: "once",
  summary: "the revision the change is measured from; without it no file carve-out can be forfeited",
};

export const REPORT_OUTPUT_OPTION: CommandOption = {
  name: "--report-output",
  value: choiceValue({ choices: reportOutputSchema.options }),
  need: "optional",
  occurrence: "once",
  summary: "how much of the report to print, over reportOutput in disciplines.json; full when neither is set",
};

export const FORFEITURE_OPTION: CommandOption = {
  name: "--forfeiture",
  value: choiceValue({ choices: forfeitureAssessmentSchema.options }),
  need: "optional",
  occurrence: "once",
  summary: "assess file carve-out decay in this run or leave it to another, over assessment.forfeiture in disciplines.json; this-run when neither is set",
};

export const ADOPTION_BASE_REVISION_OPTION: CommandOption = {
  name: "--base-revision",
  value: "<revision>",
  need: "required",
  occurrence: "once",
  summary: "the branch's base, the revision the run that assesses decay is given, such as origin/main; a file it does not hold gets no record",
};

export const LEAVE_OPTION: CommandOption = {
  name: "--leave",
  value: "<path>",
  need: "optional",
  occurrence: "repeated",
  summary: "a file or folder, relative to --repo, that gets no record because a person records it as an authorised location; give it once for each path",
};

export const COMMANDS: Readonly<Record<Subcommand, CommandSpec>> = {
  check: {
    summary: "check the repository against the disciplines it selects and print the report, ending in its verdict",
    options: [REPO_OPTION, BASE_REVISION_OPTION, REPORT_OUTPUT_OPTION, FORFEITURE_OPTION],
    exits: [
      { code: 0, meaning: "the verdict is pass" },
      { code: 1, meaning: "the verdict is fail" },
      { code: 2, meaning: "a load failure: an input could not be loaded, a mechanism failed, or Hone failed unexpectedly" },
    ],
  },
  project: {
    summary: "write the native configuration each selected embedded mechanism needs, printing each file as written or unchanged",
    options: [REPO_OPTION],
    exits: [
      { code: 0, meaning: "every projection was written or already current" },
      { code: 2, meaning: "any failure" },
    ],
  },
  [RECORD_DEBT_SUBCOMMAND]: {
    summary: "add a file carve-out naming only its clause and file to the exception records for each clause and file the check finds broken, as inherited debt, printing each pair and what was done",
    options: [REPO_OPTION, ADOPTION_BASE_REVISION_OPTION, LEAVE_OPTION],
    exits: [
      { code: 0, meaning: "every record needed was written, or none was needed" },
      { code: 2, meaning: "a load failure: an input could not be loaded, a mechanism failed, the records could not be written, or Hone failed unexpectedly" },
    ],
  },
  [SPLIT_RECORDS_SUBCOMMAND]: {
    summary: "move the exception records from discipline-exceptions.json into the discipline-exceptions folder, one file for each record kind and discipline, printing each file as written or removed",
    options: [REPO_OPTION],
    exits: [
      { code: 0, meaning: "the records were split, or there was nothing to split" },
      { code: 2, meaning: "a load failure: the records could not be read, placed or written, or Hone failed unexpectedly" },
    ],
  },
};

export const subcommandOf = (request: { readonly given: string | undefined }): Subcommand | undefined =>
  SUBCOMMANDS.find((subcommand) => subcommand === request.given);
