import type { z } from "zod";
import type { SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { Result } from "../values/result.ts";
import type {
  CarriedListing,
  HoneRecord,
  OutsideParty,
  PlacedRecord,
  RecordPlace,
  RecordsAtBase,
  RecordsDocument,
  RecordsDocumentRefusal,
  RecordsReading,
  RefusedRecord,
} from "./hone-record.ts";
import { type FiledUnder, recordOf } from "./record-resolution.ts";
import { recordsFileStandingOf } from "./records-layout.ts";
import { recordsDocumentSchema } from "./records-wire.ts";

type PlacedEntry = { readonly place: RecordPlace; readonly filedUnder: FiledUnder; readonly entry: z.core.util.JSONType };

type Judged = { readonly placed: "record"; readonly record: PlacedRecord } | { readonly placed: "refused"; readonly refused: RefusedRecord };

const outsidePartyText = (request: { readonly party: OutsideParty }): string =>
  request.party.kind === "specifier" ? request.party.specifier : `runtime:${request.party.facility}`;

const identityOf = (request: { readonly record: HoneRecord }): string => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return `${record.kind} ${record.symptom.name} ${record.file}`;
    case "deviation":
      return `${record.kind} ${record.recipe.name} ${record.file}`;
    case "boundary-record":
      return `${record.kind} ${record.module} ${outsidePartyText({ party: record.outsideParty })}`;
    case "dependency-record":
      return `${record.kind} ${record.dependency}`;
  }
};

const entriesOf = (request: { readonly document: RecordsDocument }): Result<readonly PlacedEntry[], RecordsDocumentRefusal> => {
  const { file } = request.document;
  const standing = recordsFileStandingOf({ file });
  if (standing.standing === "not-a-records-file") {
    return { outcome: "failed", error: { kind: "not-a-records-file", file } };
  }
  const parsed = recordsDocumentSchema.safeParse(request.document.document);
  if (!parsed.success) {
    return { outcome: "failed", error: { kind: "document-refused", file, issues: parsed.error.issues } };
  }
  return { outcome: "ok", value: parsed.data.records.map((entry, index) => ({ place: { file, index }, filedUnder: { kind: standing.kind }, entry })) };
};

const judgedEntry = (request: { readonly placed: PlacedEntry; readonly catalogue: SymptomCatalogue; readonly base: RecordsAtBase }): Judged => {
  const { place, filedUnder, entry } = request.placed;
  const record = recordOf({ catalogue: request.catalogue, base: request.base, file: place.file, entry, filedUnder });
  return record.outcome === "failed"
    ? { placed: "refused", refused: { place, refusals: record.error } }
    : { placed: "record", record: { place, record: record.value } };
};

const withoutDuplicates = (request: { readonly judged: readonly Judged[] }): readonly Judged[] => {
  const firstPlaces = new Map<string, RecordPlace>();
  return request.judged.map((judged) => {
    if (judged.placed === "refused") {
      return judged;
    }
    const identity = identityOf({ record: judged.record.record });
    const first = firstPlaces.get(identity);
    if (first === undefined) {
      firstPlaces.set(identity, judged.record.place);
      return judged;
    }
    return { placed: "refused", refused: { place: judged.record.place, refusals: [{ kind: "duplicate", of: first }] } };
  });
};

const readingOf = (request: { readonly judged: readonly Judged[] }): RecordsReading => ({
  records: request.judged.flatMap((judged) => (judged.placed === "record" ? [judged.record] : [])),
  refused: request.judged.flatMap((judged) => (judged.placed === "refused" ? [judged.refused] : [])),
});

const carriedOf = (request: { readonly record: HoneRecord }): readonly Omit<CarriedListing, "place">[] => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
    case "boundary-record":
      return record.holding.held === "carried" ? [{ lacks: record.holding.lacks, standing: record.holding.standing }] : [];
    case "deviation":
    case "dependency-record":
      return [];
  }
};

export const carriedListingOf = (request: { readonly records: readonly PlacedRecord[] }): readonly CarriedListing[] =>
  request.records.flatMap(({ place, record }) => carriedOf({ record }).map((carried) => ({ place, ...carried })));

export const recordsReadingOf = (request: {
  readonly documents: readonly RecordsDocument[];
  readonly catalogue: SymptomCatalogue;
  readonly base: RecordsAtBase;
}): Result<RecordsReading, readonly RecordsDocumentRefusal[]> => {
  const entries = request.documents.map((document) => entriesOf({ document }));
  const refusals = entries.flatMap((listed) => (listed.outcome === "failed" ? [listed.error] : []));
  if (refusals.length > 0) {
    return { outcome: "failed", error: refusals };
  }
  const placed = entries.flatMap((listed) => (listed.outcome === "ok" ? listed.value : []));
  const judged = placed.map((entry) => judgedEntry({ placed: entry, catalogue: request.catalogue, base: request.base }));
  return { outcome: "ok", value: readingOf({ judged: withoutDuplicates({ judged }) }) };
};
