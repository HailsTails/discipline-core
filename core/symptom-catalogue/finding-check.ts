import type { Finding } from "../governance/governance.ts";
import { checkNamedAt, checksOf } from "./check-address.ts";
import { type Check, type Engine, type Symptom, type SymptomCatalogue, symptomReadingOf } from "./symptom-catalogue.ts";

export type FindingCheck =
  | { readonly resolved: "check"; readonly check: Check }
  | { readonly resolved: "symptom-only"; readonly symptom: Symptom }
  | { readonly resolved: "none" };

const NOTHING: FindingCheck = { resolved: "none" };

const measuringEngineOf = (request: { readonly check: Check; readonly finding: Pick<Finding, "mechanism"> }): Engine | undefined =>
  request.check.engines.find((engine) => engine.mechanism === request.finding.mechanism);

const ofSymptom = (request: { readonly catalogue: SymptomCatalogue; readonly finding: Finding; readonly symptom: Symptom }): FindingCheck => {
  const candidates = checksOf({ catalogue: request.catalogue, clause: request.finding.clause })
    .filter((check) => check.symptom.name === request.symptom.name)
    .filter((check) => measuringEngineOf({ check, finding: request.finding }) !== undefined);
  const [only, ...others] = candidates;
  return only !== undefined && others.length === 0 ? { resolved: "check", check: only } : { resolved: "symptom-only", symptom: request.symptom };
};

const ofReading = (request: { readonly catalogue: SymptomCatalogue; readonly finding: Finding }): FindingCheck => {
  const reading = symptomReadingOf(request);
  return reading.reading === "named" ? ofSymptom({ ...request, symptom: reading.symptom }) : NOTHING;
};

export const checkOfFinding = (request: { readonly catalogue: SymptomCatalogue; readonly finding: Finding }): FindingCheck => {
  const named = checkNamedAt({ catalogue: request.catalogue, clause: request.finding.clause, address: request.finding.check });
  switch (named.named) {
    case "unnamed":
      return ofReading(request);
    case "check":
      return measuringEngineOf({ check: named.check, finding: request.finding }) !== undefined ? { resolved: "check", check: named.check } : NOTHING;
    case "not-of-the-clause":
      return NOTHING;
  }
};
