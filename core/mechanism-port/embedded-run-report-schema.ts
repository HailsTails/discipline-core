import { z } from "zod";
import { clauseAddressObjectSchema } from "../values/clause-address.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { Equal } from "../values/type-equality.ts";
import { hitSchema, type InlineReach, type ProjectionState, type ScriptOptionCause } from "./runner-result-schema.ts";

const inlineLineSchema = z.number().int().min(1);

export const inlineDisableSchema = z
  .object({
    kind: z.literal("inline-disable"),
    clause: clauseAddressObjectSchema,
    file: repoPathSchema,
    line: inlineLineSchema,
    text: z.string(),
    reach: z.enum(["one-clause", "every-selected-clause"]),
  })
  .readonly();

const scriptOptionCauseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("weakens-run") }).readonly(),
  z.object({ kind: z.literal("after-another-command"), command: z.string(), invocation: z.string() }).readonly(),
  z.object({ kind: z.literal("wrapped"), command: z.string(), wrapper: z.string() }).readonly(),
  z.object({ kind: z.literal("unreadable"), command: z.string() }).readonly(),
]);

export const nativeExceptionSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("ignore"), clause: clauseAddressObjectSchema, file: repoPathSchema })
    .readonly(),
  z
    .object({
      kind: z.literal("config-override"),
      clause: clauseAddressObjectSchema,
      file: repoPathSchema,
    })
    .readonly(),
  z
    .object({
      kind: z.literal("suppression-entry"),
      clause: clauseAddressObjectSchema,
      file: repoPathSchema,
      location: repoPathSchema,
    })
    .readonly(),
  inlineDisableSchema,
  z
    .object({
      kind: z.literal("inline-rule-config"),
      clause: clauseAddressObjectSchema,
      file: repoPathSchema,
      line: inlineLineSchema,
      text: z.string(),
    })
    .readonly(),
  z
    .object({
      kind: z.literal("command-line-option"),
      clause: clauseAddressObjectSchema,
      location: repoPathSchema,
      script: z.string(),
      option: z.string(),
      cause: scriptOptionCauseSchema,
    })
    .readonly(),
]);

export const sliceProblemSchema = z
  .object({
    slice: repoPathSchema,
    state: z.enum(["out-of-date", "missing", "not-applied", "unconfigured", "nested-configuration"]),
  })
  .readonly();

export type SliceProblem = z.infer<typeof sliceProblemSchema>;

export const embeddedRunReportSchema = z
  .object({
    hits: z.array(hitSchema).readonly(),
    nativeExceptions: z.array(nativeExceptionSchema).readonly(),
    projection: z.enum(["current", "out-of-date", "missing", "not-included"]),
    slices: z.array(sliceProblemSchema).readonly().default([]),
  })
  .readonly();

export type EmbeddedRunReport = z.infer<typeof embeddedRunReportSchema>;

export const isInlineReachEqual: Equal<z.infer<typeof inlineDisableSchema>["reach"], InlineReach> = true;

export const isScriptOptionCauseEqual: Equal<z.infer<typeof scriptOptionCauseSchema>, ScriptOptionCause> = true;

export const isProjectionStateEqual: Equal<EmbeddedRunReport["projection"], ProjectionState> =
  true;
