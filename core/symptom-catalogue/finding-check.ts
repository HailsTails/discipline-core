import type { Finding } from "../governance/governance.ts";
import { checkNamedAt, checksOf } from "./check-address.ts";
import { type Check, type Symptom, type SymptomCatalogue, symptomReadingOf } from "./symptom-catalogue.ts";

export type FindingCheck =
  | { readonly resolved: "check"; readonly check: Check }
  | { readonly resolved: "symptom-only"; readonly symptom: Symptom }
  | { readonly resolved: "none" };

const NOTHING: FindingCheck = { resolved: "none" };

const measuredBy = (request: { readonly check: Check; readonly finding: Pick<Finding, "mechanism"> }): boolean =>
  request.check.engines.some((engine) => engine.mechanism === request.finding.mechanism);

const ofSymptom = (request: { readonly catalogue: SymptomCatalogue; readonly finding: Finding; readonly symptom: Symptom }): FindingCheck => {
  const candidates = checksOf({ catalogue: request.catalogue, clause: request.finding.clause })
    .filter((check) => check.symptom.name === request.symptom.name)
    .filter((check) => measuredBy({ check, finding: request.finding }));
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
      return measuredBy({ check: named.check, finding: request.finding }) ? { resolved: "check", check: named.check } : NOTHING;
    case "not-of-the-clause":
      return NOTHING;
  }
};
