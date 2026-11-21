import { z } from "zod";
import { repoPathSchema } from "../values/repo-path.ts";
import type { DeepReadonly, Equal } from "../values/type-equality.ts";
import type { ChecksRunReport, ChecksSliceProblem, LoadedChecksRunner, MisnamedRuleId, NotReadyYetFailure, ProjectedFile } from "./checks-runner-types.ts";
import { nativeExceptionSchema } from "./embedded-run-report-schema.ts";
import { runnerCallSchema } from "./runner-module-schema.ts";
import { hitSchema, measuredPairSchema, nativeExceptionKindSchema } from "./runner-result-schema.ts";
import { runnerFailureSchema } from "./runner-failure-schema.ts";

export const checksRunnerModuleSchema = z.object({
  projectedKinds: z.array(nativeExceptionKindSchema),
  run: runnerCallSchema,
  conform: runnerCallSchema,
  project: runnerCallSchema,
});

export const misnamedRuleIdSchema = z
  .object({
    kind: z.enum(["version-1-id", "names-no-check"]),
    ruleId: z.string().min(1),
    file: repoPathSchema,
    line: z.number().int().min(1),
    text: z.string(),
    replacedBy: z.array(z.string().min(1)).readonly(),
  })
  .readonly();

export const checksSliceProblemSchema = z
  .object({
    slice: repoPathSchema,
    state: z.enum(["missing", "out-of-date", "unconfigured"]),
  })
  .readonly();

export const checksRunReportSchema = z
  .object({
    hits: z.array(hitSchema).readonly(),
    nativeExceptions: z.array(nativeExceptionSchema).readonly(),
    measured: z.array(measuredPairSchema).readonly(),
    projection: z.enum(["current", "out-of-date", "missing", "not-included"]),
    slices: z.array(checksSliceProblemSchema).readonly(),
    misnamedRuleIds: z.array(misnamedRuleIdSchema).readonly(),
  })
  .readonly();

const notReadyYetFailureSchema = z
  .object({
    kind: z.literal("not-ready-yet"),
    what: z
      .object({
        thing: z.literal("eslint-config-roots"),
        paths: z.array(z.string()).min(1).readonly(),
      })
      .readonly(),
  })
  .readonly();

export const checksRunResultSchema = z.union([
  z.object({ outcome: z.literal("ok"), value: checksRunReportSchema }).readonly(),
  z.object({ outcome: z.literal("failed"), error: z.union([runnerFailureSchema, notReadyYetFailureSchema]) }).readonly(),
]);

export const projectedFileSchema = z.object({ file: repoPathSchema, text: z.string() }).readonly();

export const checksProjectResultSchema = z.union([
  z.object({ outcome: z.literal("ok"), value: z.array(projectedFileSchema).readonly() }).readonly(),
  z.object({ outcome: z.literal("failed"), error: z.union([runnerFailureSchema, notReadyYetFailureSchema]) }).readonly(),
]);

export const isProjectedFileSchemaEqual: Equal<DeepReadonly<z.output<typeof projectedFileSchema>>, ProjectedFile> = true;

export const isChecksModuleKeySetEqual: Equal<keyof LoadedChecksRunner, keyof z.output<typeof checksRunnerModuleSchema>> = true;

export const isChecksRunReportSchemaEqual: Equal<DeepReadonly<z.output<typeof checksRunReportSchema>>, ChecksRunReport> = true;

export const isChecksSliceProblemSchemaEqual: Equal<DeepReadonly<z.output<typeof checksSliceProblemSchema>>, ChecksSliceProblem> = true;

export const isMisnamedRuleIdSchemaEqual: Equal<DeepReadonly<z.output<typeof misnamedRuleIdSchema>>, MisnamedRuleId> = true;

export const isNotReadyYetFailureSchemaEqual: Equal<DeepReadonly<z.output<typeof notReadyYetFailureSchema>>, NotReadyYetFailure> = true;
