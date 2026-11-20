import type { AttributedNativeException, Finding, GovernedRun } from "../governance/governance.ts";
import type { NativeException } from "../mechanism-port/runner-result-schema.ts";
import { checksOf } from "../symptom-catalogue/check-address.ts";
import { type SymptomCatalogue, symptomReadingOf } from "../symptom-catalogue/symptom-catalogue.ts";
import type { TouchedSet } from "../touched-set/touched-set.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { PlacedRecord } from "./hone-record.ts";
import { holdsAt, overlapsAt, type PartyReport, type Site } from "./record-reach.ts";

export type RaisedFinding = { readonly finding: Finding; readonly party: PartyReport };

export type AnsweredFinding = { readonly finding: Finding; readonly by: readonly PlacedRecord[] };

export type DoublyHeldDebt = { readonly debt: PlacedRecord; readonly alsoHeldBy: readonly PlacedRecord[] };

export type AnsweringRequest = {
  readonly catalogue: SymptomCatalogue;
  readonly records: readonly PlacedRecord[];
  readonly findings: readonly RaisedFinding[];
  readonly touched: TouchedSet;
  readonly runs: readonly GovernedRun[];
};

export type Answering = {
  readonly findings: readonly Finding[];
  readonly answered: readonly AnsweredFinding[];
  readonly stale: readonly PlacedRecord[];
  readonly forfeited: readonly PlacedRecord[];
  readonly doublyHeld: readonly DoublyHeldDebt[];
  readonly unrecorded: readonly AttributedNativeException[];
};

const NOT_REPORTED: PartyReport = { reported: "not-reported" };

const holdersAt = (request: { readonly records: readonly PlacedRecord[]; readonly sites: readonly Site[]; readonly catalogue: SymptomCatalogue }): readonly PlacedRecord[] =>
  request.records.filter((placed) => request.sites.some((site) => holdsAt({ record: placed.record, site, catalogue: request.catalogue }) === "holds"));

const answerersOf = (request: { readonly holders: readonly PlacedRecord[] }): readonly PlacedRecord[] => {
  const others = request.holders.filter((placed) => placed.record.kind !== "debt");
  return others.length === 0 ? request.holders : others;
};

const forfeitedRecords = (request: { readonly records: readonly PlacedRecord[]; readonly touched: TouchedSet }): readonly PlacedRecord[] => {
  switch (request.touched.measured) {
    case "no":
    case "elsewhere":
      return [];
    case "yes": {
      const touchedPaths = request.touched.paths;
      return request.records.filter((placed) => placed.record.kind === "debt" && touchedPaths.has(placed.record.file));
    }
  }
};

const alsoHeldByOf = (request: { readonly debt: PlacedRecord; readonly others: readonly PlacedRecord[] }): readonly PlacedRecord[] => {
  const { record } = request.debt;
  return record.kind === "debt"
    ? request.others.filter((placed) => overlapsAt({ record: placed.record, symptom: record.symptom, file: record.file }) === "holds")
    : [];
};

const doublyHeldDebts = (request: { readonly inForce: readonly PlacedRecord[] }): readonly DoublyHeldDebt[] => {
  const others = request.inForce.filter((placed) => placed.record.kind !== "debt");
  return request.inForce.flatMap((debt) => {
    const alsoHeldBy = alsoHeldByOf({ debt, others });
    return alsoHeldBy.length === 0 ? [] : [{ debt, alsoHeldBy }];
  });
};

const findingSitesOf = (request: { readonly raised: RaisedFinding; readonly catalogue: SymptomCatalogue }): readonly Site[] => {
  const reading = symptomReadingOf({ catalogue: request.catalogue, finding: request.raised.finding });
  return reading.reading === "named" ? [{ symptom: reading.symptom, file: request.raised.finding.file, party: request.raised.party }] : [];
};

const fileOfNative = (request: { readonly exception: NativeException }): readonly RepoPath[] => {
  switch (request.exception.kind) {
    case "command-line-option":
      return [];
    case "inline-disable":
    case "ignore":
    case "config-override":
    case "suppression-entry":
    case "inline-rule-config":
      return [request.exception.file];
  }
};

const nativeSitesOf = (request: {
  readonly exception: NativeException;
  readonly run: GovernedRun;
  readonly catalogue: SymptomCatalogue;
}): readonly Site[] => {
  if (!request.run.coverableKinds.includes(request.exception.kind)) {
    return [];
  }
  const symptoms = checksOf({ catalogue: request.catalogue, clause: request.exception.clause })
    .filter((check) => check.engines.some((engine) => engine.mechanism === request.run.mechanism))
    .map((check) => check.symptom);
  return fileOfNative(request).flatMap((file) => symptoms.map((symptom) => ({ symptom, file, party: NOT_REPORTED })));
};

const attributed = (request: { readonly exception: NativeException; readonly mechanism: MechanismId }): AttributedNativeException => ({
  ...request.exception,
  mechanism: request.mechanism,
});

const nativeHoldings = (request: {
  readonly runs: readonly GovernedRun[];
  readonly inForce: readonly PlacedRecord[];
  readonly catalogue: SymptomCatalogue;
}): readonly { readonly exception: AttributedNativeException; readonly holders: readonly PlacedRecord[] }[] =>
  request.runs.flatMap((run) =>
    run.nativeExceptions.map((exception) => ({
      exception: attributed({ exception, mechanism: run.mechanism }),
      holders: holdersAt({ records: request.inForce, sites: nativeSitesOf({ exception, run, catalogue: request.catalogue }), catalogue: request.catalogue }),
    })),
  );

const staleRecords = (request: {
  readonly inForce: readonly PlacedRecord[];
  readonly credited: ReadonlySet<PlacedRecord>;
  readonly paired: ReadonlySet<PlacedRecord>;
}): readonly PlacedRecord[] =>
  request.inForce.filter((placed) => placed.record.kind !== "dependency-record" && !request.credited.has(placed) && !request.paired.has(placed));

export const answerFindings = (request: AnsweringRequest): Answering => {
  const { catalogue } = request;
  const forfeited = forfeitedRecords(request);
  const inForce = request.records.filter((placed) => !forfeited.includes(placed));
  const doublyHeld = doublyHeldDebts({ inForce });
  const judged = request.findings.map((raised) => ({
    finding: raised.finding,
    by: answerersOf({ holders: holdersAt({ records: inForce, sites: findingSitesOf({ raised, catalogue }), catalogue }) }),
  }));
  const natives = nativeHoldings({ runs: request.runs, inForce, catalogue });
  const credited = new Set([...judged.flatMap((entry) => entry.by), ...natives.flatMap((native) => answerersOf({ holders: native.holders }))]);
  const paired = new Set(doublyHeld.flatMap((pair) => [pair.debt, ...pair.alsoHeldBy]));
  return {
    findings: judged.flatMap((entry) => (entry.by.length === 0 ? [entry.finding] : [])),
    answered: judged.filter((entry) => entry.by.length > 0),
    stale: staleRecords({ inForce, credited, paired }),
    forfeited,
    doublyHeld,
    unrecorded: natives.flatMap((native) => (native.holders.length === 0 ? [native.exception] : [])),
  };
};
