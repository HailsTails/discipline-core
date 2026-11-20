import type { Finding } from "../governance/governance.ts";
import type { RunReport } from "../report/run-report.ts";
import type { SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { TouchedSet } from "../touched-set/touched-set.ts";
import type { BaseRevisionAvailability } from "../values/base-revision-availability.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import { type AuthoriseRequest, type Authorising, authorisingOf } from "./authorising.ts";
import { type DebtOutcome, debtOutcomesOf } from "./debt-effects.ts";
import { debtSitesOf, unrecordableSitesOf } from "./debt-sites.ts";
import type { RecordsAtBase, RecordsDocument, RecordsReading } from "./hone-record.ts";
import { type PrunableDebt, prunableDebtOf } from "./prunable-debt.ts";
import type { HoneRecordsFailure } from "./read-hone-records.ts";
import { symptomNameOf } from "./record-address.ts";
import { documentsWithAdded, documentsWithRemoved, type RecordAddition } from "./records-edit.ts";
import { namedRecordsFileOf } from "./records-layout.ts";
import { recordsReadingOf } from "./records-reading.ts";
import type { RecordsSource } from "./records-source.ts";
import type { RecordsStore, RecordsUnwritable } from "./records-store.ts";

export type RecordCommandFailure = HoneRecordsFailure | RecordsUnwritable | { readonly kind: "git-failed"; readonly detail: string };

export type RecordDebtPorts = {
  readonly catalogue: SymptomCatalogue;
  readonly source: Pick<RecordsSource, "read">;
  readonly store: RecordsStore;
};

export type RecordDebtRequest = {
  readonly findings: readonly Finding[];
  readonly touched: TouchedSet;
  readonly leave: readonly RepoPath[];
};

export type PruneDebtPorts = { readonly source: Pick<RecordsSource, "read">; readonly store: RecordsStore };

export type AuthorisePorts = { readonly catalogue: SymptomCatalogue; readonly source: Pick<RecordsSource, "read">; readonly store: RecordsStore };

type Commanded<Value> = Result<Value, RecordCommandFailure>;

const UNMEASURED_BASE: RecordsAtBase = { measured: "no", base: { state: "not-given" } };

const DEBT_FOLDER = repoPathSchema.parse("hone-records/debt");

const documentsOf = (request: { readonly source: Pick<RecordsSource, "read"> }): Commanded<readonly RecordsDocument[]> => {
  const read = request.source.read();
  return read.outcome === "failed" ? { outcome: "failed", error: { kind: "records-folder", failure: read.error } } : read;
};

const unmeasuredFailure = (request: { readonly base: BaseRevisionAvailability }): Commanded<never> => ({
  outcome: "failed",
  error: { kind: "git-failed", detail: request.base.state === "git-failed" ? request.base.gitMessage : "no base revision was given" },
});

const heldDebtOf = (request: { readonly ports: RecordDebtPorts; readonly documents: readonly RecordsDocument[] }): Commanded<RecordsReading> => {
  const reading = recordsReadingOf({ documents: request.documents, catalogue: request.ports.catalogue, base: UNMEASURED_BASE });
  return reading.outcome === "failed" ? { outcome: "failed", error: { kind: "records-documents", refusals: reading.error } } : reading;
};

const additionOf = (request: { readonly outcome: DebtOutcome }): Commanded<readonly RecordAddition[]> => {
  const file = namedRecordsFileOf({ kind: "debt", name: symptomNameOf({ address: request.outcome.address }) });
  return file.outcome === "failed"
    ? { outcome: "failed", error: { kind: "records-folder", failure: { kind: "not-a-records-name", folder: DEBT_FOLDER, name: file.error.name } } }
    : { outcome: "ok", value: [{ file: file.value, entry: { symptom: request.outcome.address, file: request.outcome.file } }] };
};

const additionsOf = (request: { readonly outcomes: readonly DebtOutcome[] }): Commanded<readonly RecordAddition[]> =>
  request.outcomes
    .filter((outcome) => outcome.effect === "recorded")
    .reduce<Commanded<readonly RecordAddition[]>>((sofar, outcome) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      const addition = additionOf({ outcome });
      return addition.outcome === "failed" ? addition : { outcome: "ok", value: [...sofar.value, ...addition.value] };
    }, { outcome: "ok", value: [] });

const storedAdditions = (request: { readonly store: RecordsStore; readonly documents: readonly RecordsDocument[]; readonly additions: readonly RecordAddition[] }): Commanded<void> => {
  if (request.additions.length === 0) {
    return { outcome: "ok", value: undefined };
  }
  const added = documentsWithAdded(request);
  return added.outcome === "failed" ? added : request.store.apply({ edit: { write: added.value, remove: [] } });
};

const outcomesOf = (request: { readonly ports: RecordDebtPorts; readonly run: RecordDebtRequest; readonly documents: readonly RecordsDocument[] }): Commanded<readonly DebtOutcome[]> => {
  const held = heldDebtOf(request);
  if (held.outcome === "failed") {
    return held;
  }
  const { touched } = request.run;
  if (touched.measured === "no") {
    return unmeasuredFailure({ base: touched.base });
  }
  return {
    outcome: "ok",
    value: debtOutcomesOf({
      sites: debtSitesOf({ catalogue: request.ports.catalogue, findings: request.run.findings }),
      unrecordable: unrecordableSitesOf({ catalogue: request.ports.catalogue, findings: request.run.findings }),
      records: held.value.records,
      leave: request.run.leave,
      touched,
    }),
  };
};

export const recordDebtOf =
  (ports: RecordDebtPorts) =>
  (run: RecordDebtRequest): Commanded<readonly DebtOutcome[]> => {
    if (run.findings.length === 0) {
      return { outcome: "ok", value: [] };
    }
    const documents = documentsOf(ports);
    if (documents.outcome === "failed") {
      return documents;
    }
    const outcomes = outcomesOf({ ports, run, documents: documents.value });
    if (outcomes.outcome === "failed") {
      return outcomes;
    }
    const additions = additionsOf({ outcomes: outcomes.value });
    if (additions.outcome === "failed") {
      return additions;
    }
    const stored = storedAdditions({ store: ports.store, documents: documents.value, additions: additions.value });
    return stored.outcome === "failed" ? stored : outcomes;
  };

export const pruneDebtOf =
  (ports: PruneDebtPorts) =>
  (request: { readonly report: Pick<RunReport, "paid" | "stale" | "forfeited"> }): Commanded<readonly PrunableDebt[]> => {
    const prunable = prunableDebtOf(request);
    if (prunable.length === 0) {
      return { outcome: "ok", value: [] };
    }
    const documents = documentsOf(ports);
    if (documents.outcome === "failed") {
      return documents;
    }
    const edit = documentsWithRemoved({ documents: documents.value, places: prunable.map((pruned) => pruned.place) });
    if (edit.outcome === "failed") {
      return edit;
    }
    const stored = ports.store.apply({ edit: edit.value });
    return stored.outcome === "failed" ? stored : { outcome: "ok", value: prunable };
  };

export const authoriseOf =
  (ports: AuthorisePorts) =>
  (request: AuthoriseRequest): Commanded<Authorising> => {
    const documents = documentsOf(ports);
    if (documents.outcome === "failed") {
      return documents;
    }
    const authorising = authorisingOf({ request, documents: documents.value, catalogue: ports.catalogue });
    if (authorising.outcome === "failed" || authorising.value.judged !== "accepted") {
      return authorising;
    }
    const stored = ports.store.apply({ edit: authorising.value.edit });
    return stored.outcome === "failed" ? stored : authorising;
  };
