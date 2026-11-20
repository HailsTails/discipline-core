import { z } from "zod";
import type { Selection } from "../../settings/selection.ts";
import type { FileExceptionWhyChains } from "../../values/file-exception-why-chains.ts";
import type { Result } from "../../values/result.ts";
import {
  type ExceptionBaseline,
  type ExceptionRecord,
  type InvalidRecord,
  type PlacedEntry,
  parseExceptionEntries,
} from "../version-one-records/exception-records.ts";
import type { CarriedEntry, RecordInput } from "../version-two-mapping/records-mapping.ts";

export type HeadRecord =
  | Exclude<RecordInput, { readonly kind: "file-carve-out" }>
  | {
      readonly kind: "file-carve-out";
      readonly record: Extract<ExceptionRecord, { readonly kind: "file-carve-out" }>;
      readonly entry: CarriedEntry;
    };

export type HeadRecordsRequest = {
  readonly entries: readonly PlacedEntry[];
  readonly selection: Selection;
  readonly fileExceptionWhyChains: FileExceptionWhyChains;
  readonly baseline: ExceptionBaseline;
};

const carriedEntrySchema = z.record(z.string(), z.json());

const headRecordOf = (request: { readonly record: ExceptionRecord; readonly entry: CarriedEntry }): HeadRecord => {
  const { record, entry } = request;
  switch (record.kind) {
    case "file-carve-out":
      return { kind: record.kind, record, entry };
    case "authorised-location":
      return { kind: record.kind, record, entry };
    case "clause-wide-carve-out":
      return { kind: record.kind, record };
  }
};

const headRecordsOfPlaced = (request: HeadRecordsRequest & { readonly placed: PlacedEntry }): readonly HeadRecord[] => {
  const entry = carriedEntrySchema.safeParse(request.placed.entry);
  const { records } = parseExceptionEntries({ ...request, entries: [request.placed] });
  return entry.success ? records.map((record) => headRecordOf({ record, entry: entry.data })) : [];
};

export const headRecordsOf = (request: HeadRecordsRequest): Result<readonly HeadRecord[], readonly InvalidRecord[]> => {
  const { invalid } = parseExceptionEntries(request);
  return invalid.length > 0
    ? { outcome: "failed", error: invalid }
    : { outcome: "ok", value: request.entries.flatMap((placed) => headRecordsOfPlaced({ ...request, placed })) };
};
