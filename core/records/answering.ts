import type { AttributedNativeException, Finding, GovernedRun } from "../governance/governance.ts";
import type { NativeException } from "../mechanism-port/runner-result-schema.ts";
import { checksOf } from "../symptom-catalogue/check-address.ts";
import { type SymptomCatalogue, symptomReadingOf } from "../symptom-catalogue/symptom-catalogue.ts";
import type { TouchedSet } from "../touched-set/touched-set.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { PlacedRecord } from "./hone-record.ts";
import { holdsAt, type RaisedBy, type Site } from "./record-reach.ts";

export type RaisedFinding = { readonly finding: Finding; readonly raisedBy: RaisedBy };

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

const NOT_AN_IMPORT: RaisedBy = { kind: "not-an-import" };

const holdersAt = (request: { readonly records: readonly PlacedRecord[]; readonly sites: readonly Site[]; readonly catalogue: SymptomCatalogue }): readonly PlacedRecord[] =>
  request.records.filter((placed) => request.sites.some((site) => holdsAt({ record: placed.record, site, catalogue: request.catalogue }) === "holds"));

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

const debtSitesOf = (request: { readonly placed: PlacedRecord }): readonly Site[] =>
  request.placed.record.kind === "debt" ? [{ symptom: request.placed.record.symptom, file: request.placed.record.file, raisedBy: NOT_AN_IMPORT }] : [];

const doublyHeldDebts = (request: { readonly inForce: readonly PlacedRecord[]; readonly catalogue: SymptomCatalogue }): readonly DoublyHeldDebt[] => {
  const others = request.inForce.filter((placed) => placed.record.kind !== "debt");
  return request.inForce.flatMap((placed) => {
    const alsoHeldBy = holdersAt({ records: others, sites: debtSitesOf({ placed }), catalogue: request.catalogue });
    return alsoHeldBy.length === 0 ? [] : [{ debt: placed, alsoHeldBy }];
  });
};

const findingSitesOf = (request: { readonly raised: RaisedFinding; readonly catalogue: SymptomCatalogue }): readonly Site[] => {
  const reading = symptomReadingOf({ catalogue: request.catalogue, finding: request.raised.finding });
  return reading.reading === "named" ? [{ symptom: reading.symptom, file: request.raised.finding.file, raisedBy: request.raised.raisedBy }] : [];
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
  return fileOfNative(request).flatMap((file) => symptoms.map((symptom) => ({ symptom, file, raisedBy: NOT_AN_IMPORT })));
};

const attributed = (request: { readonly exception: NativeException; readonly mechanism: MechanismId }): AttributedNativeException => ({
  ...request.exception,
  mechanism: request.mechanism,
});

const unrecordedExceptions = (request: {
  readonly runs: readonly GovernedRun[];
  readonly inForce: readonly PlacedRecord[];
  readonly catalogue: SymptomCatalogue;
}): readonly AttributedNativeException[] =>
  request.runs.flatMap((run) =>
    run.nativeExceptions.flatMap((exception) =>
      holdersAt({ records: request.inForce, sites: nativeSitesOf({ exception, run, catalogue: request.catalogue }), catalogue: request.catalogue }).length === 0
        ? [attributed({ exception, mechanism: run.mechanism })]
        : [],
    ),
  );

const nativeHolders = (request: {
  readonly runs: readonly GovernedRun[];
  readonly answering: readonly PlacedRecord[];
  readonly catalogue: SymptomCatalogue;
}): readonly PlacedRecord[] =>
  request.runs.flatMap((run) =>
    run.nativeExceptions.flatMap((exception) =>
      holdersAt({ records: request.answering, sites: nativeSitesOf({ exception, run, catalogue: request.catalogue }), catalogue: request.catalogue }),
    ),
  );

const staleRecords = (request: {
  readonly answering: readonly PlacedRecord[];
  readonly credited: ReadonlySet<PlacedRecord>;
  readonly paired: ReadonlySet<PlacedRecord>;
}): readonly PlacedRecord[] =>
  request.answering.filter(
    (placed) => placed.record.kind !== "dependency-record" && !request.credited.has(placed) && !request.paired.has(placed),
  );

export const answerFindings = (request: AnsweringRequest): Answering => {
  const { catalogue } = request;
  const forfeited = forfeitedRecords(request);
  const inForce = request.records.filter((placed) => !forfeited.includes(placed));
  const doublyHeld = doublyHeldDebts({ inForce, catalogue });
  const heldDebts = new Set(doublyHeld.map((pair) => pair.debt));
  const answering = inForce.filter((placed) => !heldDebts.has(placed));
  const judged = request.findings.map((raised) => ({
    finding: raised.finding,
    by: holdersAt({ records: answering, sites: findingSitesOf({ raised, catalogue }), catalogue }),
  }));
  const credited = new Set([...judged.flatMap((entry) => entry.by), ...nativeHolders({ runs: request.runs, answering, catalogue })]);
  const paired = new Set(doublyHeld.flatMap((pair) => [pair.debt, ...pair.alsoHeldBy]));
  return {
    findings: judged.flatMap((entry) => (entry.by.length === 0 ? [entry.finding] : [])),
    answered: judged.filter((entry) => entry.by.length > 0),
    stale: staleRecords({ answering, credited, paired }),
    forfeited,
    doublyHeld,
    unrecorded: unrecordedExceptions({ runs: request.runs, inForce, catalogue }),
  };
};
