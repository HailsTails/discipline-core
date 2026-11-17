import type { ExitCode } from "../platform-ports/process-port.ts";
import { forfeitureAssessmentSchema } from "../values/assessment.ts";
import { reportOutputSchema } from "../values/report-output.ts";

export const SUBCOMMANDS = ["check", "project"] as const;

export type Subcommand = (typeof SUBCOMMANDS)[number];

export type HelpTopic = "tool" | Subcommand;

export type OptionName = "--repo" | "--base-revision" | "--report-output" | "--forfeiture";

export type CommandOption = {
  readonly name: OptionName;
  readonly value: string;
  readonly need: "required" | "optional";
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
  summary: "the folder that holds disciplines.json, usually the repository root",
};

export const BASE_REVISION_OPTION: CommandOption = {
  name: "--base-revision",
  value: "<revision>",
  need: "optional",
  summary: "the revision the change is measured from; without it no file carve-out can be forfeited",
};

export const REPORT_OUTPUT_OPTION: CommandOption = {
  name: "--report-output",
  value: choiceValue({ choices: reportOutputSchema.options }),
  need: "optional",
  summary: "how much of the report to print, over reportOutput in disciplines.json; full when neither is set",
};

export const FORFEITURE_OPTION: CommandOption = {
  name: "--forfeiture",
  value: choiceValue({ choices: forfeitureAssessmentSchema.options }),
  need: "optional",
  summary: "assess file carve-out decay in this run or leave it to another, over assessment.forfeiture in disciplines.json; this-run when neither is set",
};

export const COMMANDS: Readonly<Record<Subcommand, CommandSpec>> = {
  check: {
    summary: "check the repository against the disciplines it selects and print the report, ending in its verdict",
    options: [REPO_OPTION, BASE_REVISION_OPTION, REPORT_OUTPUT_OPTION, FORFEITURE_OPTION],
    exits: [
      { code: 0, meaning: "the verdict is pass" },
      { code: 1, meaning: "the verdict is fail" },
      { code: 2, meaning: "an input could not be loaded, or a mechanism failed or returned invalid output" },
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
};

export const subcommandOf = (request: { readonly given: string | undefined }): Subcommand | undefined =>
  SUBCOMMANDS.find((subcommand) => subcommand === request.given);
