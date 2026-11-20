import { z } from "zod";
import type { RecordsDocument } from "../../records/hone-record.ts";
import { recordedReachSchema, recordsDocumentSchema } from "../../records/records-wire.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import { checkAddressOf } from "../../symptom-catalogue/check-address.ts";
import { clauseAddressSchema } from "../../values/clause-address.ts";
import { sameJsonValue } from "../../values/json-kind.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import { checksOfClause } from "../version-two-mapping/clause-checks.ts";
import type { VersionOneEntry } from "./version-one-entries.ts";

const carriedDebtSchema = z.looseObject({ symptom: recordedReachSchema, file: repoPathSchema, carried: z.json() });

const carriedCarveOutSchema = z.looseObject({ kind: z.literal("file-carve-out"), clause: clauseAddressSchema, file: repoPathSchema });

type BaseStanding = "held-at-base" | "not-held-at-base";

const heldAtBaseOf = (request: {
  readonly record: unknown;
  readonly entries: readonly VersionOneEntry[];
  readonly catalogues: readonly RuleSetCatalogue[];
}): BaseStanding => {
  const parsed = carriedDebtSchema.safeParse(request.record);
  if (!parsed.success || parsed.data.symptom.reaches !== "one-check") {
    return "not-held-at-base";
  }
  const { symptom, file, carried } = parsed.data;
  const carveOut = carriedCarveOutSchema.safeParse(carried);
  if (!carveOut.success || carveOut.data.file !== file) {
    return "not-held-at-base";
  }
  const reachedCheck = `${symptom.symptom}#${symptom.check}`;
  const reachesOneCheckOfClause = checksOfClause({ catalogues: request.catalogues, clause: carveOut.data.clause }).some(
    (check) => checkAddressOf({ check }) === reachedCheck,
  );
  const heldWordForWord = request.entries.some((entry) => sameJsonValue({ left: carried, right: entry }) === "same");
  return reachesOneCheckOfClause && heldWordForWord ? "held-at-base" : "not-held-at-base";
};

const documentOf = (request: {
  readonly head: RecordsDocument;
  readonly entries: readonly VersionOneEntry[];
  readonly catalogues: readonly RuleSetCatalogue[];
}): readonly RecordsDocument[] => {
  const parsed = recordsDocumentSchema.safeParse(request.head.document);
  if (!parsed.success) {
    return [];
  }
  const records = parsed.data.records.filter((record) => heldAtBaseOf({ record, entries: request.entries, catalogues: request.catalogues }) === "held-at-base");
  return records.length === 0 ? [] : [{ file: request.head.file, document: { version: parsed.data.version, records } }];
};

export const carriedDebtDocumentsAtBaseOf = (request: {
  readonly head: readonly RecordsDocument[];
  readonly entries: readonly VersionOneEntry[];
  readonly catalogues: readonly RuleSetCatalogue[];
}): readonly RecordsDocument[] =>
  request.head.flatMap((head) => documentOf({ head, entries: request.entries, catalogues: request.catalogues }));
