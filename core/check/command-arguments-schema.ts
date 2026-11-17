import { z } from "zod";
import {
  type ForfeitureAssessment,
  forfeitureAssessmentSchema,
  removedText,
  WAIVED_CLAUSES_REPLACEMENT,
} from "../values/assessment.ts";
import { type ReportOutput, reportOutputSchema } from "../values/report-output.ts";
import type { Result } from "../values/result.ts";
import { TOOL_IDENTITY } from "../values/tool-identity.ts";
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

const REPO_OPTION = "--repo";
const BASE_REVISION_OPTION = "--base-revision";
const REPORT_OUTPUT_OPTION = "--report-output";
const FORFEITURE_OPTION = "--forfeiture";

const REMOVED_CHECK_OPTIONS: ReadonlyMap<string, string> = new Map([["--waived-clauses", WAIVED_CLAUSES_REPLACEMENT]]);

const optionPairs = (request: { readonly arguments: readonly string[] }): readonly unknown[] =>
  Array.from({ length: Math.ceil(request.arguments.length / 2) }, (_, index) => [
    request.arguments[index * 2],
    request.arguments[index * 2 + 1],
  ]);

const optionsSchema = (request: { readonly options: readonly [string, ...string[]] }) =>
  z
    .array(z.tuple([z.enum(request.options), z.string()]))
    .refine((pairs) => new Set(pairs.map(([option]) => option)).size === pairs.length, {
      error: "an option is given more than once",
    })
    .transform((pairs) => Object.fromEntries(pairs));

const checkArgumentsSchema = optionsSchema({ options: [REPO_OPTION, BASE_REVISION_OPTION, REPORT_OUTPUT_OPTION, FORFEITURE_OPTION] })
  .pipe(
    z.strictObject({
      [REPO_OPTION]: z.string(),
      [BASE_REVISION_OPTION]: z.string().optional(),
      [REPORT_OUTPUT_OPTION]: reportOutputSchema.optional(),
      [FORFEITURE_OPTION]: forfeitureAssessmentSchema.optional(),
    }),
  )
  .transform(
    (options): CheckArguments => ({
      repo: options[REPO_OPTION],
      baseRevision: options[BASE_REVISION_OPTION],
      reportOutput: options[REPORT_OUTPUT_OPTION],
      forfeiture: options[FORFEITURE_OPTION],
    }),
  );

const projectArgumentsSchema = optionsSchema({ options: [REPO_OPTION] })
  .pipe(z.strictObject({ [REPO_OPTION]: z.string() }))
  .transform((options): ProjectArguments => ({ repo: options[REPO_OPTION] }));

const parsedArguments = <Parsed>(request: {
  readonly schema: z.ZodType<Parsed>;
  readonly arguments: readonly string[];
}): Result<Parsed, LoadFailure> => {
  const parsed = request.schema.safeParse(optionPairs(request));
  if (!parsed.success) {
    return { outcome: "failed", error: { kind: "arguments-invalid", detail: z.prettifyError(parsed.error) } };
  }
  return { outcome: "ok", value: parsed.data };
};

const removedOptionsIn = (request: { readonly arguments: readonly string[] }): readonly string[] =>
  request.arguments.flatMap((argument) => {
    const instead = REMOVED_CHECK_OPTIONS.get(argument);
    return instead === undefined ? [] : [removedText({ removed: argument, instead })];
  });

export const parseCheckArguments = (request: {
  readonly arguments: readonly string[];
}): Result<CheckArguments, LoadFailure> => {
  const [removed] = removedOptionsIn(request);
  if (removed !== undefined) {
    return { outcome: "failed", error: { kind: "arguments-invalid", detail: removed } };
  }
  return parsedArguments({ schema: checkArgumentsSchema, arguments: request.arguments });
};

export const parseProjectArguments = (request: {
  readonly arguments: readonly string[];
}): Result<ProjectArguments, LoadFailure> =>
  parsedArguments({ schema: projectArgumentsSchema, arguments: request.arguments });

const subcommandSchema = z.enum(["check", "project"]);

export type Subcommand = z.infer<typeof subcommandSchema>;

export type SubcommandInvocation = {
  readonly subcommand: Subcommand;
  readonly arguments: readonly string[];
};

const USAGE = [
  `usage: ${TOOL_IDENTITY.command} check ${REPO_OPTION} <path> [${BASE_REVISION_OPTION} <revision>] [${REPORT_OUTPUT_OPTION} <${reportOutputSchema.options.join("|")}>] [${FORFEITURE_OPTION} <${forfeitureAssessmentSchema.options.join("|")}>]`,
  `${TOOL_IDENTITY.command} project ${REPO_OPTION} <path>`,
].join(" | ");

const subcommandProblem = (request: { readonly given: string | undefined }): string =>
  request.given === undefined ? "a subcommand is required" : `unknown subcommand ${JSON.stringify(request.given)}`;

export const parseSubcommand = (request: {
  readonly arguments: readonly string[];
}): Result<SubcommandInvocation, LoadFailure> => {
  const [given, ...rest] = request.arguments;
  const subcommand = subcommandSchema.safeParse(given);
  if (!subcommand.success) {
    return { outcome: "failed", error: { kind: "arguments-invalid", detail: `${subcommandProblem({ given })}; ${USAGE}` } };
  }
  return { outcome: "ok", value: { subcommand: subcommand.data, arguments: rest } };
};
