import type { SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import type { Why } from "../values/why-chain.ts";
import type { RecordPlace, RecordRefusal, RecordsAtBase, RecordsDocument } from "./hone-record.ts";
import { symptomNameOf } from "./record-address.ts";
import { documentsWithAdded, placeOfAddition, type RecordAddition, type RecordsEdit, type RecordsEditFailure } from "./records-edit.ts";
import { namedRecordsFileOf } from "./records-layout.ts";
import { recordsReadingOf } from "./records-reading.ts";

export type AuthoriseRequest = {
  readonly symptom: string;
  readonly file: RepoPath;
  readonly case: string;
  readonly owes: string;
  readonly whys: readonly Why[];
  readonly rootCause: string;
  readonly rootEvidence: string;
  readonly readback: string;
  readonly owner: string;
};

export type Authorising =
  | { readonly judged: "accepted"; readonly edit: RecordsEdit }
  | { readonly judged: "already-held"; readonly heldIn: RepoPath }
  | { readonly judged: "refused"; readonly refusals: readonly RecordRefusal[] };

type Judging = {
  readonly documents: readonly RecordsDocument[];
  readonly catalogue: SymptomCatalogue;
  readonly addition: RecordAddition;
};

const UNMEASURED_BASE: RecordsAtBase = { measured: "no", base: { state: "not-given" } };

const entryOf = (request: { readonly request: AuthoriseRequest }): RecordAddition["entry"] => {
  const { symptom, file, case: caseName, owes, whys, rootCause, rootEvidence, readback, owner } = request.request;
  return { symptom, file, case: caseName, owes, whyChain: { whys, rootCause, rootEvidence, readback, owner } };
};

const refusedOutcome = (request: { readonly refusals: readonly RecordRefusal[] }): Authorising => {
  const [first] = request.refusals;
  return request.refusals.length === 1 && first?.kind === "duplicate"
    ? { judged: "already-held", heldIn: first.of.file }
    : { judged: "refused", refusals: request.refusals };
};

const refusalsAt = (request: { readonly refused: readonly { readonly place: RecordPlace; readonly refusals: readonly RecordRefusal[] }[]; readonly place: RecordPlace }): readonly RecordRefusal[] =>
  request.refused.filter((candidate) => candidate.place.file === request.place.file && candidate.place.index === request.place.index).flatMap((candidate) => candidate.refusals);

const judgedAddition = (request: Judging): Result<Authorising, RecordsEditFailure> => {
  const added = documentsWithAdded({ documents: request.documents, additions: [request.addition] });
  if (added.outcome === "failed") {
    return added;
  }
  const reading = recordsReadingOf({
    documents: [...request.documents.filter((document) => document.file !== request.addition.file), ...added.value],
    catalogue: request.catalogue,
    base: UNMEASURED_BASE,
  });
  if (reading.outcome === "failed") {
    return { outcome: "failed", error: { kind: "records-documents", refusals: reading.error } };
  }
  const refusals = refusalsAt({ refused: reading.value.refused, place: placeOfAddition(request) });
  return { outcome: "ok", value: refusals.length === 0 ? { judged: "accepted", edit: { write: added.value, remove: [] } } : refusedOutcome({ refusals }) };
};

export const authorisingOf = (request: {
  readonly request: AuthoriseRequest;
  readonly documents: readonly RecordsDocument[];
  readonly catalogue: SymptomCatalogue;
}): Result<Authorising, RecordsEditFailure> => {
  const file = namedRecordsFileOf({ kind: "authorised-locations", name: symptomNameOf({ address: request.request.symptom }) });
  if (file.outcome === "failed") {
    return { outcome: "ok", value: { judged: "refused", refusals: [file.error] } };
  }
  return judgedAddition({ documents: request.documents, catalogue: request.catalogue, addition: { file: file.value, entry: entryOf({ request: request.request }) } });
};
