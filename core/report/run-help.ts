import { type CommandOption, type CommandSpec, HELP_FLAGS, VERSION_FLAG } from "../check/command-line.ts";
import { RECORDS_FOLDER } from "../records/records-layout.ts";
import { SETTINGS_FILE_NAME } from "../settings/settings-sources.ts";
import { forfeitureAssessmentSchema } from "../values/assessment.ts";
import { reportOutputSchema } from "../values/report-output.ts";
import { TOOL_IDENTITY } from "../values/tool-identity.ts";

export type RunSubcommand = "check" | "project" | "record-debt" | "prune-debt" | "upgrade";

export type RunHelpTopic = "tool" | RunSubcommand;

type HelpEntry = { readonly term: string; readonly text: string };

export const RUN_SUBCOMMANDS: readonly RunSubcommand[] = ["check", "project", "record-debt", "prune-debt", "upgrade"];

const COMMAND = TOOL_IDENTITY.command;

const VERSION_ONE_SETTINGS_FILE = "disciplines.json";

const DESCRIPTION = `Checks a repository against the checks ${SETTINGS_FILE_NAME} lists, answers its findings by the records in ${RECORDS_FOLDER} and prints one verdict.`;

const INDENT = "  ";

const DESCRIPTION_INDENT = "      ";

const COLUMN_GAP = 2;

const HELP_TERM = HELP_FLAGS.join(", ");

const LOAD_FAILURE_EXIT = "a load failure: an input could not be loaded, an engine failed";

const choiceValue = (request: { readonly choices: readonly string[] }): string => `<${request.choices.join("|")}>`;

const REPO_OPTION: CommandOption = {
  name: "--repo",
  value: "<dir>",
  need: "required",
  occurrence: "once",
  summary: `the folder that holds ${SETTINGS_FILE_NAME}, usually the repository root`,
};

const UPGRADE_REPO_OPTION: CommandOption = {
  ...REPO_OPTION,
  summary: `the folder that holds ${VERSION_ONE_SETTINGS_FILE}, usually the repository root; upgrade writes ${SETTINGS_FILE_NAME} beside it`,
};

const BASE_REVISION_OPTION: CommandOption = {
  name: "--base-revision",
  value: "<revision>",
  need: "optional",
  occurrence: "once",
  summary: "the revision the change is measured from; without it no debt can be forfeited and no carried record is checked against it",
};

const REPORT_OUTPUT_OPTION: CommandOption = {
  name: "--report-output",
  value: choiceValue({ choices: reportOutputSchema.options }),
  need: "optional",
  occurrence: "once",
  summary: `how much of the report to print, over reportOutput in ${SETTINGS_FILE_NAME}; full when neither is set`,
};

const FORFEITURE_OPTION: CommandOption = {
  name: "--forfeiture",
  value: choiceValue({ choices: forfeitureAssessmentSchema.options }),
  need: "optional",
  occurrence: "once",
  summary: `check debt for forfeiture in this run or leave it to another, over forfeiture in ${SETTINGS_FILE_NAME}; this-run when neither is set`,
};

const ADOPTION_BASE_REVISION_OPTION: CommandOption = {
  name: "--base-revision",
  value: "<revision>",
  need: "required",
  occurrence: "once",
  summary: "the branch's base, such as origin/main; a file it does not hold gets no debt",
};

const LEAVE_OPTION: CommandOption = {
  name: "--leave",
  value: "<path>",
  need: "optional",
  occurrence: "repeated",
  summary: "a file or folder, relative to --repo, that gets no debt because a person records it as an authorised location; give it once for each path",
};

export const RUN_COMMANDS: Readonly<Record<RunSubcommand, CommandSpec>> = {
  check: {
    summary: `check the repository against the checks ${SETTINGS_FILE_NAME} lists and print the report, ending in its verdict`,
    options: [REPO_OPTION, BASE_REVISION_OPTION, REPORT_OUTPUT_OPTION, FORFEITURE_OPTION],
    exits: [
      { code: 0, meaning: "the verdict is pass" },
      { code: 1, meaning: "the verdict is fail" },
      { code: 2, meaning: `${LOAD_FAILURE_EXIT}, or Hone failed unexpectedly` },
    ],
  },
  project: {
    summary: "write the native configuration, hone.<engine>.mjs, for each engine that runs a listed check through one, printing each file as written or unchanged",
    options: [REPO_OPTION],
    exits: [
      { code: 0, meaning: "every projection was written or already current" },
      { code: 2, meaning: "any failure" },
    ],
  },
  "record-debt": {
    summary: `add debt to ${RECORDS_FOLDER} for each symptom and file the check finds, printing each and what was done`,
    options: [REPO_OPTION, ADOPTION_BASE_REVISION_OPTION, LEAVE_OPTION],
    exits: [
      { code: 0, meaning: "every debt needed was written, or none was needed" },
      { code: 2, meaning: `${LOAD_FAILURE_EXIT}, the records could not be written, or Hone failed unexpectedly` },
    ],
  },
  "prune-debt": {
    summary: `remove from ${RECORDS_FOLDER} the debt a run shows is paid, stale or forfeited, printing each debt removed`,
    options: [REPO_OPTION, BASE_REVISION_OPTION, FORFEITURE_OPTION],
    exits: [
      { code: 0, meaning: "every debt the run showed paid, stale or forfeited was removed, or none was shown" },
      { code: 2, meaning: `${LOAD_FAILURE_EXIT}, the records could not be written, or Hone failed unexpectedly` },
    ],
  },
  upgrade: {
    summary: `rewrite version 1 files as version 2: ${VERSION_ONE_SETTINGS_FILE} as ${SETTINGS_FILE_NAME} and the exception records as ${RECORDS_FOLDER}, printing each file as written or removed`,
    options: [UPGRADE_REPO_OPTION],
    exits: [
      { code: 0, meaning: "every version 1 file was rewritten, or none was found" },
      { code: 2, meaning: "a load failure: a version 1 file could not be read or a version 2 file written, or Hone failed unexpectedly" },
    ],
  },
};

const alignedEntries = (request: { readonly entries: readonly HelpEntry[] }): readonly string[] => {
  const width = Math.max(...request.entries.map((entry) => entry.term.length)) + COLUMN_GAP;
  return request.entries.map((entry) => `${INDENT}${entry.term.padEnd(width)}${entry.text}`);
};

const stackedEntries = (request: { readonly entries: readonly HelpEntry[] }): readonly string[] =>
  request.entries.flatMap((entry) => [`${INDENT}${entry.term}`, `${DESCRIPTION_INDENT}${entry.text}`]);

const usageTerm = (request: { readonly option: CommandOption }): string => {
  const term = `${request.option.name} ${request.option.value}`;
  const given = request.option.need === "required" ? term : `[${term}]`;
  return request.option.occurrence === "repeated" ? `${given}...` : given;
};

const commandUsage = (request: { readonly subcommand: RunSubcommand }): string =>
  `${COMMAND} ${request.subcommand} ${RUN_COMMANDS[request.subcommand].options.map((option) => usageTerm({ option })).join(" ")}`;

const helpLines = (request: { readonly blocks: readonly (readonly string[])[] }): string => `${request.blocks.map((block) => block.join("\n")).join("\n\n")}\n`;

const toolHelp = (): string =>
  helpLines({
    blocks: [
      [`usage: ${COMMAND} <command> [options]`],
      [DESCRIPTION],
      ["commands:", ...alignedEntries({ entries: RUN_SUBCOMMANDS.map((subcommand) => ({ term: subcommand, text: RUN_COMMANDS[subcommand].summary })) })],
      [
        "options:",
        ...alignedEntries({
          entries: [
            { term: HELP_TERM, text: "print this help; after a command, print that command's help" },
            { term: VERSION_FLAG, text: `print the installed version of ${TOOL_IDENTITY.packageName}` },
          ],
        }),
      ],
      [`run ${COMMAND} <command> --help for a command's options and exit codes`],
    ],
  });

const subcommandHelp = (request: { readonly subcommand: RunSubcommand }): string => {
  const spec = RUN_COMMANDS[request.subcommand];
  return helpLines({
    blocks: [
      [`usage: ${commandUsage(request)}`],
      [spec.summary],
      [
        "options:",
        ...stackedEntries({
          entries: [...spec.options.map((option) => ({ term: `${option.name} ${option.value}`, text: option.summary })), { term: HELP_TERM, text: "print this help" }],
        }),
      ],
      ["exit codes:", ...alignedEntries({ entries: spec.exits.map((exit) => ({ term: String(exit.code), text: exit.meaning })) })],
    ],
  });
};

export const runHelpText = (request: { readonly topic: RunHelpTopic }): string =>
  request.topic === "tool" ? toolHelp() : subcommandHelp({ subcommand: request.topic });

export const RUN_SYNOPSIS = `${[...RUN_SUBCOMMANDS.map((subcommand) => commandUsage({ subcommand })), `${COMMAND} ${HELP_FLAGS[0]}`, `${COMMAND} ${VERSION_FLAG}`].join("\n")}\n`;
