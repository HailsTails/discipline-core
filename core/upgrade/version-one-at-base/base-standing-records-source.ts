import { z } from "zod";
import type { RecordsDocument } from "../../records/hone-record.ts";
import type { RecordsSourceOf } from "../../records/records-folder.ts";
import type { RecordsSource } from "../../records/records-source.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import { clauseAddressSchema, TOOL_RULE_SET } from "../../values/clause-address.ts";
import type { AbsolutePath } from "../../values/absolute-path.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import type { ExceptionRepository } from "../version-one-records/exception-records.ts";
import { type RecordInput, mappedRecords } from "../version-two-mapping/records-mapping.ts";
import { carriedDebtDocumentsAtBaseOf } from "./carried-debt-at-base.ts";
import { type VersionOneEntries, type VersionOneEntry, versionOneEntriesOf } from "./version-one-entries.ts";

const authorisedLocationEntrySchema = z.object({
  kind: z.literal("authorised-location"),
  clause: clauseAddressSchema,
  file: repoPathSchema,
});

const inputsOf = (request: { readonly entry: VersionOneEntry }): readonly RecordInput[] => {
  const parsed = authorisedLocationEntrySchema.safeParse(request.entry);
  return parsed.success
    ? [{ kind: "authorised-location", record: { clause: parsed.data.clause, file: parsed.data.file }, entry: request.entry }]
    : [];
};

const documentsMappedFrom = (request: {
  readonly entries: readonly VersionOneEntry[];
  readonly catalogues: readonly RuleSetCatalogue[];
}): readonly RecordsDocument[] => {
  const { catalogues } = request;
  const inputs = request.entries.flatMap((entry) => inputsOf({ entry }));
  const mappable = inputs.filter((input) => mappedRecords({ inputs: [input], catalogues }).outcome === "ok");
  const mapped = mappedRecords({ inputs: mappable, catalogues });
  return mapped.outcome === "ok" ? mapped.value.documents.map(({ file, version, records }) => ({ file, document: { version, records } })) : [];
};

export const baseStandingRecordsSource = (request: {
  readonly source: RecordsSource;
  readonly entries: VersionOneEntries;
  readonly catalogues: readonly RuleSetCatalogue[];
}): RecordsSource => ({
  read: request.source.read,
  readAt: ({ revision }) => {
    const base = request.source.readAt({ revision });
    if (base.outcome === "failed") {
      return base;
    }
    const entries = request.entries.atBase({ revision });
    if (entries.outcome === "failed") {
      return entries;
    }
    const head = request.source.read();
    const heldAtBase = new Set(base.value.map(({ file }) => file));
    const absentAtBase = [
      ...documentsMappedFrom({ entries: entries.value, catalogues: request.catalogues }),
      ...(head.outcome === "ok" ? carriedDebtDocumentsAtBaseOf({ head: head.value, entries: entries.value, catalogues: request.catalogues }) : []),
    ].filter(({ file }) => !heldAtBase.has(file));
    return { outcome: "ok", value: [...base.value, ...absentAtBase] };
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
      catalogues: [{ ruleSet: TOOL_RULE_SET, catalogue: folder.catalogue }],
    });
