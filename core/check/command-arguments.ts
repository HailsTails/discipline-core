import { type ForfeitureAssessment, forfeitureAssessmentSchema, WAIVED_CLAUSES_REPLACEMENT } from "../values/assessment.ts";
import { type ReportOutput, reportOutputSchema } from "../values/report-output.ts";
import type { Result } from "../values/result.ts";
import { type ArgumentProblem, argumentsInvalid } from "./argument-problem.ts";
import {
  BASE_REVISION_OPTION,
  COMMANDS,
  type CommandOption,
  FORFEITURE_OPTION,
  HELP_FLAGS,
  type HelpTopic,
  type OptionName,
  REPO_OPTION,
  REPORT_OUTPUT_OPTION,
  type Subcommand,
  subcommandOf,
  VERSION_FLAG,
} from "./command-line.ts";
import type { LoadFailure } from "./load-failure.ts";

export type CheckArguments = {
  readonly repo: string;
  readonly baseRevision: string | undefined;
  readonly reportOutput: ReportOutput | undefined;
  readonly forfeiture: ForfeitureAssessment | undefined;
};

export type ProjectArguments = {
  readonly repo: string;
};

export type Invocation =
  | { readonly kind: "run"; readonly subcommand: Subcommand; readonly arguments: readonly string[] }
  | { readonly kind: "help"; readonly topic: HelpTopic }
  | { readonly kind: "version" };

type OptionValues = ReadonlyMap<OptionName, string>;

const FLAG_MARKER = "-";

const JOINED_VALUE_MARKER = "=";

const REMOVED_OPTIONS: ReadonlyMap<string, string> = new Map([["--waived-clauses", WAIVED_CLAUSES_REPLACEMENT]]);

const failedWith = (request: { readonly problem: ArgumentProblem }): { readonly outcome: "failed"; readonly error: LoadFailure } =>
  argumentsInvalid(request);

const optionNamed = (request: { readonly subcommand: Subcommand; readonly given: string }): CommandOption | undefined =>
  COMMANDS[request.subcommand].options.find((option) => option.name === request.given);

const unknownArgumentProblem = (request: { readonly subcommand: Subcommand; readonly given: string }): ArgumentProblem => {
  if (!request.given.startsWith(FLAG_MARKER)) {
    return { kind: "argument-unexpected", ...request };
  }
  const joined = optionNamed({ subcommand: request.subcommand, given: request.given.split(JOINED_VALUE_MARKER)[0] });
  return joined === undefined ? { kind: "option-unknown", ...request } : { kind: "option-joined", option: joined, given: request.given };
};

const removedOptionProblem = (request: { readonly arguments: readonly string[] }): ArgumentProblem | undefined => {
  const removed = request.arguments.find((argument) => REMOVED_OPTIONS.has(argument));
  const instead = removed === undefined ? undefined : REMOVED_OPTIONS.get(removed);
  return removed === undefined || instead === undefined ? undefined : { kind: "option-removed", given: removed, instead };
};

const optionValuesFrom = (request: {
  readonly subcommand: Subcommand;
  readonly remaining: readonly string[];
  readonly given: OptionValues;
}): Result<OptionValues, LoadFailure> => {
  const [name, given, ...rest] = request.remaining;
  if (name === undefined) {
    return { outcome: "ok", value: request.given };
  }
  const option = optionNamed({ subcommand: request.subcommand, given: name });
  if (option === undefined) {
    return failedWith({ problem: unknownArgumentProblem({ subcommand: request.subcommand, given: name }) });
  }
  if (given === undefined || given.startsWith(FLAG_MARKER)) {
    return failedWith({ problem: { kind: "value-missing", option } });
  }
  if (request.given.has(option.name)) {
    return failedWith({ problem: { kind: "option-repeated", option } });
  }
  return optionValuesFrom({ ...request, remaining: rest, given: new Map([...request.given, [option.name, given]]) });
};

const givenOptionValues = (request: {
  readonly subcommand: Subcommand;
  readonly arguments: readonly string[];
}): Result<OptionValues, LoadFailure> => {
  const removed = removedOptionProblem(request);
  if (removed !== undefined) {
    return failedWith({ problem: removed });
  }
  return optionValuesFrom({ subcommand: request.subcommand, remaining: request.arguments, given: new Map() });
};

const requiredRepo = (request: { readonly subcommand: Subcommand; readonly values: OptionValues }): Result<string, LoadFailure> => {
  const repo = request.values.get(REPO_OPTION.name);
  return repo === undefined
    ? failedWith({ problem: { kind: "option-required", subcommand: request.subcommand, option: REPO_OPTION } })
    : { outcome: "ok", value: repo };
};

const chosenValue = <Choice extends string>(request: {
  readonly option: CommandOption;
  readonly choices: readonly Choice[];
  readonly values: OptionValues;
}): Result<Choice | undefined, LoadFailure> => {
  const given = request.values.get(request.option.name);
  const chosen = request.choices.find((choice) => choice === given);
  if (given !== undefined && chosen === undefined) {
    return failedWith({ problem: { kind: "choice-invalid", option: request.option, choices: request.choices, given } });
  }
  return { outcome: "ok", value: chosen };
};

const checkArgumentsOf = (request: { readonly values: OptionValues }): Result<CheckArguments, LoadFailure> => {
  const repo = requiredRepo({ subcommand: "check", values: request.values });
  if (repo.outcome === "failed") {
    return repo;
  }
  const reportOutput = chosenValue({ option: REPORT_OUTPUT_OPTION, choices: reportOutputSchema.options, values: request.values });
  if (reportOutput.outcome === "failed") {
    return reportOutput;
  }
  const forfeiture = chosenValue({ option: FORFEITURE_OPTION, choices: forfeitureAssessmentSchema.options, values: request.values });
  if (forfeiture.outcome === "failed") {
    return forfeiture;
  }
  return {
    outcome: "ok",
    value: {
      repo: repo.value,
      baseRevision: request.values.get(BASE_REVISION_OPTION.name),
      reportOutput: reportOutput.value,
      forfeiture: forfeiture.value,
    },
  };
};

export const parseCheckArguments = (request: {
  readonly arguments: readonly string[];
}): Result<CheckArguments, LoadFailure> => {
  const values = givenOptionValues({ subcommand: "check", arguments: request.arguments });
  return values.outcome === "failed" ? values : checkArgumentsOf({ values: values.value });
};

export const parseProjectArguments = (request: {
  readonly arguments: readonly string[];
}): Result<ProjectArguments, LoadFailure> => {
  const values = givenOptionValues({ subcommand: "project", arguments: request.arguments });
  if (values.outcome === "failed") {
    return values;
  }
  const repo = requiredRepo({ subcommand: "project", values: values.value });
  return repo.outcome === "failed" ? repo : { outcome: "ok", value: { repo: repo.value } };
};

const optionNamePositions = (request: { readonly arguments: readonly string[] }): readonly string[] =>
  request.arguments.filter((_, position) => position % 2 === 0);

const asksForHelp = (request: { readonly arguments: readonly string[] }): "help" | "no-help" =>
  optionNamePositions(request).some((argument) => HELP_FLAGS.includes(argument)) ? "help" : "no-help";

const toolFlagOf = (request: { readonly given: string | undefined }): "help" | "version" | undefined => {
  if (request.given !== undefined && HELP_FLAGS.includes(request.given)) {
    return "help";
  }
  return request.given === VERSION_FLAG ? "version" : undefined;
};

const toolFlagInvocation = (request: {
  readonly flag: "help" | "version";
  readonly given: string;
  readonly rest: readonly string[];
}): Result<Invocation, LoadFailure> => {
  const [after, ...beyond] = request.rest;
  if (after === undefined) {
    return { outcome: "ok", value: request.flag === "help" ? { kind: "help", topic: "tool" } : { kind: "version" } };
  }
  const topic = request.flag === "help" && beyond.length === 0 ? subcommandOf({ given: after }) : undefined;
  return topic === undefined
    ? failedWith({ problem: { kind: "flag-extra", flag: request.given, given: after } })
    : { outcome: "ok", value: { kind: "help", topic } };
};

export const parseInvocation = (request: { readonly arguments: readonly string[] }): Result<Invocation, LoadFailure> => {
  const [given, ...rest] = request.arguments;
  const flag = toolFlagOf({ given });
  if (flag !== undefined && given !== undefined) {
    return toolFlagInvocation({ flag, given, rest });
  }
  const subcommand = subcommandOf({ given });
  if (subcommand === undefined) {
    return failedWith({ problem: given === undefined ? { kind: "command-missing" } : { kind: "command-unknown", given } });
  }
  return {
    outcome: "ok",
    value:
      asksForHelp({ arguments: rest }) === "help"
        ? { kind: "help", topic: subcommand }
        : { kind: "run", subcommand, arguments: rest },
  };
};
