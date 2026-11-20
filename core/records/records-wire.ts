import { z } from "zod";
import { catalogueNameSchema } from "../symptom-catalogue/symptom-catalogue-wire.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { whyChainSchema } from "../values/why-chain.ts";

export const RECORDS_VERSION = 2;

const PACKAGE_NAME = String.raw`(?:@[A-Za-z0-9][A-Za-z0-9._~-]*\/)?[A-Za-z0-9][A-Za-z0-9._~-]*`;

const SUBPATH = String.raw`(?:\/[A-Za-z0-9._~@-]+)*`;

const VERSION = "(?:@[A-Za-z0-9.^~<>=*|+-]+)?";

const RUNTIME = "runtime:[a-z]+";

const NPM_SPECIFIER = `npm:${PACKAGE_NAME}${VERSION}${SUBPATH}`;

const SCHEME_MODULE = String.raw`(?!runtime:|npm:)[a-z][a-z0-9+.-]*:\S+`;

const textSchema = z.string().trim().min(1);

export const packageNameSchema = z.string().regex(new RegExp(`^${PACKAGE_NAME}$`), { error: "is not the name of one direct outside dependency" });

export const outsidePartySchema = z
  .string()
  .regex(new RegExp(`^(?:${RUNTIME}|${NPM_SPECIFIER}|${SCHEME_MODULE}|${PACKAGE_NAME}${SUBPATH})$`), {
    error: "is not a runtime facility or an outside module's specifier",
  });

const carriedEntrySchema = z.record(z.string(), z.json());

export const recordsDocumentSchema = z.strictObject({ version: z.literal(RECORDS_VERSION), records: z.array(z.json()) });

export const carriedFormSchema = z.looseObject({ carried: z.json() });

export const debtWireSchema = z.strictObject({ symptom: catalogueNameSchema, file: repoPathSchema, note: textSchema.optional(), carried: carriedEntrySchema.optional() });

export const statedAuthorisedLocationWireSchema = z.strictObject({
  symptom: catalogueNameSchema,
  file: repoPathSchema,
  case: textSchema,
  owes: textSchema,
  whyChain: whyChainSchema,
});

export const carriedAuthorisedLocationWireSchema = z.strictObject({ symptom: catalogueNameSchema, file: repoPathSchema, carried: carriedEntrySchema });

export const statedBoundaryRecordWireSchema = z.strictObject({
  module: repoPathSchema,
  outsideParty: outsidePartySchema,
  ports: z.array(textSchema).min(1),
  conformist: z.strictObject({ model: textSchema, why: textSchema }).optional(),
});

export const carriedBoundaryRecordWireSchema = z.strictObject({ module: repoPathSchema, outsideParty: outsidePartySchema, carried: carriedEntrySchema });

export const deviationWireSchema = z.strictObject({
  recipe: catalogueNameSchema,
  file: repoPathSchema,
  recipeReason: textSchema,
  reasonFails: textSchema,
  evidence: textSchema,
  ruleHolds: textSchema,
});

export const dependencyRecordWireSchema = z.strictObject({
  dependency: packageNameSchema,
  nativeWay: textSchema,
  whyNotEnough: textSchema,
  peerRisk: textSchema.optional(),
});
