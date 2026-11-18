import { z } from "zod";
import { anchorSchema } from "../values/anchor-schema.ts";
import { type ClauseAddress, clauseAddressObjectSchema } from "../values/clause-address.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import { snippetSchema } from "../values/snippet.ts";
import type { DeepReadonly, Equal } from "../values/type-equality.ts";
import { runnerFailureSchema } from "./runner-failure-schema.ts";
import type { Hit } from "./runner-result-types.ts";

export type { Hit } from "./runner-result-types.ts";

export const nativeExceptionKindSchema = z.enum([
  "ignore",
  "config-override",
  "suppression-entry",
  "inline-disable",
  "inline-rule-config",
  "command-line-option",
]);

export type InlineReach = "one-clause" | "every-selected-clause";

export type ScriptOptionCause =
  | { readonly kind: "weakens-run" }
  | { readonly kind: "after-another-command"; readonly command: string; readonly invocation: string }
  | { readonly kind: "wrapped"; readonly command: string; readonly wrapper: string }
  | { readonly kind: "unreadable"; readonly command: string };

export type NativeException =
  | { readonly kind: "ignore"; readonly clause: ClauseAddress; readonly file: RepoPath }
  | { readonly kind: "config-override"; readonly clause: ClauseAddress; readonly file: RepoPath }
  | {
      readonly kind: "suppression-entry";
      readonly clause: ClauseAddress;
      readonly file: RepoPath;
      readonly location: RepoPath;
    }
  | {
      readonly kind: "inline-disable";
      readonly clause: ClauseAddress;
      readonly file: RepoPath;
      readonly line: number;
      readonly text: string;
      readonly reach: InlineReach;
    }
  | {
      readonly kind: "inline-rule-config";
      readonly clause: ClauseAddress;
      readonly file: RepoPath;
      readonly line: number;
      readonly text: string;
    }
  | {
      readonly kind: "command-line-option";
      readonly clause: ClauseAddress;
      readonly location: RepoPath;
      readonly script: string;
      readonly option: string;
      readonly cause: ScriptOptionCause;
    };

export type InlineDisable = Extract<NativeException, { readonly kind: "inline-disable" }>;

export type ProjectionState = "current" | "out-of-date" | "missing" | "not-included";

export const hitSchema = z
  .object({
    clause: clauseAddressObjectSchema,
    file: repoPathSchema,
    anchor: anchorSchema,
    snippet: snippetSchema,
  })
  .readonly();

export const isHitSchemaEqual: Equal<DeepReadonly<z.output<typeof hitSchema>>, Hit> = true;

export const caseVerdictSchema = z
  .object({
    caseName: z.string(),
    flaggedLines: z.array(z.number().int().min(1)).readonly(),
  })
  .readonly();

export type CaseVerdict = z.infer<typeof caseVerdictSchema>;

export const projectionWriteSchema = z
  .object({
    path: repoPathSchema,
    effect: z.enum(["written", "unchanged", "removed", "left-in-place"]),
  })
  .readonly();

export type ProjectionWrite = z.infer<typeof projectionWriteSchema>;

export const runnerResultSchema = <Value extends z.ZodType>(request: {
  readonly value: Value;
}) =>
  z.union([
    z.object({ outcome: z.literal("ok"), value: request.value }).readonly(),
    z.object({ outcome: z.literal("failed"), error: runnerFailureSchema }).readonly(),
  ]);
