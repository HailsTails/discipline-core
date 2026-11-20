import { z } from "zod";
import { repoPathSchema } from "../values/repo-path.ts";
import { whyChainSchema } from "../values/why-chain.ts";

export const RECORDS_VERSION = 2;

const nameSchema = z.string().min(1);

const textSchema = z.string().trim().min(1);

const carriedEntrySchema = z.record(z.string(), z.json());

export const recordsDocumentSchema = z.strictObject({ version: z.literal(RECORDS_VERSION), records: z.array(z.json()) });

export const carriedFormSchema = z.looseObject({ carried: z.json() });

export const debtWireSchema = z.strictObject({ symptom: nameSchema, file: repoPathSchema, note: textSchema.optional(), carried: carriedEntrySchema.optional() });

export const statedAuthorisedLocationWireSchema = z.strictObject({
  symptom: nameSchema,
  file: repoPathSchema,
  case: nameSchema,
  owes: nameSchema,
  whyChain: whyChainSchema,
});

export const carriedAuthorisedLocationWireSchema = z.strictObject({ symptom: nameSchema, file: repoPathSchema, carried: carriedEntrySchema });

export const statedBoundaryRecordWireSchema = z.strictObject({
  module: repoPathSchema,
  outsideParty: nameSchema,
  ports: z.array(nameSchema).min(1),
  conformist: z.strictObject({ model: textSchema, why: textSchema }).optional(),
});

export const carriedBoundaryRecordWireSchema = z.strictObject({ module: repoPathSchema, outsideParty: nameSchema, carried: carriedEntrySchema });

export const deviationWireSchema = z.strictObject({
  recipe: nameSchema,
  file: repoPathSchema,
  recipeReason: textSchema,
  reasonFails: textSchema,
  evidence: textSchema,
  ruleHolds: textSchema,
});

export const dependencyRecordWireSchema = z.strictObject({
  dependency: nameSchema,
  nativeWay: textSchema,
  whyNotEnough: textSchema,
  peerRisk: textSchema.optional(),
});
