import type { RecordsSourceOf } from "../../records/records-folder.ts";
import type { RecordsSource } from "../../records/records-source.ts";
import type { SymptomCatalogue } from "../../symptom-catalogue/symptom-catalogue.ts";
import { TOOL_RULE_SET } from "../../values/clause-address.ts";
import { baseStandingRecordsSource } from "../version-one-at-base/base-standing-records-source.ts";
import { versionOneEntriesOf } from "../version-one-at-base/version-one-entries.ts";
import type { ExceptionRepository, ExceptionRepositoryOf } from "../version-one-records/exception-records.ts";
import { foundTreeExceptionsOf } from "./found-tree-exceptions.ts";

export const foundTreeRecordsSourceOver = (request: {
  readonly source: RecordsSource;
  readonly exceptions: Pick<ExceptionRepository, "read" | "readAt">;
  readonly catalogue: SymptomCatalogue;
}): RecordsSource =>
  baseStandingRecordsSource({
    source: { read: request.source.read, readAt: () => ({ outcome: "ok", value: [] }) },
    entries: versionOneEntriesOf({ repository: foundTreeExceptionsOf({ repository: request.exceptions }) }),
    catalogues: [{ ruleSet: TOOL_RULE_SET, catalogue: request.catalogue }],
  });

export const foundTreeRecordsSourceOf = (request: { readonly recordsSourceOf: RecordsSourceOf; readonly exceptionsOf: ExceptionRepositoryOf }): RecordsSourceOf =>
  (folder) =>
    foundTreeRecordsSourceOver({ source: request.recordsSourceOf(folder), exceptions: request.exceptionsOf({ repoRoot: folder.repoRoot }), catalogue: folder.catalogue });
