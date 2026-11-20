import { z } from "zod";
import type { AbsolutePath } from "../../values/absolute-path.ts";
import type { RecordsDocument } from "../../records/hone-record.ts";
import type { RecordsSourceOf } from "../../records/records-folder.ts";
import type { RecordsSource } from "../../records/records-source.ts";
import { RECORDS_VERSION, recordsDocumentSchema } from "../../records/records-wire.ts";
import type { ReadonlyJsonValue } from "../../values/json-value.ts";
import type { ExceptionRepository } from "../version-one-records/exception-records.ts";
import { type VersionOneEntries, type VersionOneEntry, versionOneEntriesOf } from "./version-one-entries.ts";

const recordSchema = z.record(z.string(), z.json());

const carriedReachSchema = z.object({ carried: z.object({ clause: z.string(), file: z.string() }) });

const entriesCarriedBy = (request: { readonly record: z.core.util.JSONType; readonly entries: readonly VersionOneEntry[] }): readonly VersionOneEntry[] => {
  const reach = carriedReachSchema.safeParse(request.record);
  return reach.success
    ? request.entries.filter((entry) => entry.clause === reach.data.carried.clause && entry.file === reach.data.carried.file)
    : [];
};

const recordsAtBaseOf = (request: { readonly head: RecordsDocument; readonly entries: readonly VersionOneEntry[] }): readonly ReadonlyJsonValue[] => {
  const document = recordsDocumentSchema.safeParse(request.head.document);
  return document.success
    ? document.data.records.flatMap((record) => {
        const parsed = recordSchema.safeParse(record);
        return parsed.success ? entriesCarriedBy({ record, entries: request.entries }).map((carried) => ({ ...parsed.data, carried })) : [];
      })
    : [];
};

const synthesisedDocumentOf = (request: { readonly head: RecordsDocument; readonly entries: readonly VersionOneEntry[] }): readonly RecordsDocument[] => {
  const records = recordsAtBaseOf(request);
  return records.length === 0 ? [] : [{ file: request.head.file, document: { version: RECORDS_VERSION, records } }];
};

export const baseStandingRecordsSource = (request: { readonly source: RecordsSource; readonly entries: VersionOneEntries }): RecordsSource => ({
  read: request.source.read,
  readAt: ({ revision }) => {
    const base = request.source.readAt({ revision });
    const head = request.source.read();
    if (base.outcome === "failed" || head.outcome === "failed") {
      return base;
    }
    const entries = request.entries.atBase({ revision });
    if (entries.outcome === "failed") {
      return entries;
    }
    const heldAtBase = new Set(base.value.map(({ file }) => file));
    const absentAtBase = head.value.filter(({ file }) => !heldAtBase.has(file));
    return {
      outcome: "ok",
      value: [...base.value, ...absentAtBase.flatMap((document) => synthesisedDocumentOf({ head: document, entries: entries.value }))],
    };
  },
});

export const versionOneAwareRecordsSourceOf = (request: {
  readonly recordsSourceOf: RecordsSourceOf;
  readonly exceptionRepositoryOf: (request: { readonly repoRoot: AbsolutePath }) => Pick<ExceptionRepository, "readAt">;
}): RecordsSourceOf =>
  (folder) =>
    baseStandingRecordsSource({
      source: request.recordsSourceOf(folder),
      entries: versionOneEntriesOf({ repository: request.exceptionRepositoryOf({ repoRoot: folder.repoRoot }) }),
    });
