import type { Finding } from "../governance/governance.ts";
import type { NativeException } from "../mechanism-port/runner-result-schema.ts";
import { checkAddressOf, checksOf } from "../symptom-catalogue/check-address.ts";
import { type Check, type Engine, type Symptom, type SymptomCatalogue, symptomReadingOf } from "../symptom-catalogue/symptom-catalogue.ts";
import { type ClauseAddress, clauseAddressText } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";

export type CheckSite =
  | { readonly sited: "check"; readonly check: Check; readonly engine: Engine }
  | { readonly sited: "unchecked"; readonly clause: ClauseAddress; readonly mechanism: MechanismId };

type EngineRequest = { readonly catalogue: SymptomCatalogue; readonly clause: ClauseAddress; readonly mechanism: MechanismId };

const uncheckedSite = (request: EngineRequest): CheckSite => ({ sited: "unchecked", clause: request.clause, mechanism: request.mechanism });

const sitesOfCheck = (request: { readonly check: Check; readonly mechanism: MechanismId }): readonly CheckSite[] =>
  request.check.engines.filter((engine) => engine.mechanism === request.mechanism).map((engine) => ({ sited: "check", check: request.check, engine }));

const sitesAtEngine = (request: EngineRequest): readonly CheckSite[] => checksOf(request).flatMap((check) => sitesOfCheck({ check, mechanism: request.mechanism }));

const siteOfSymptom = (request: EngineRequest & { readonly symptom: Symptom }): CheckSite => {
  const sites = checksOf(request)
    .filter((check) => check.symptom.name === request.symptom.name)
    .flatMap((check) => sitesOfCheck({ check, mechanism: request.mechanism }));
  return sites[0] ?? uncheckedSite(request);
};

export const findingSiteOf = (request: { readonly catalogue: SymptomCatalogue; readonly finding: Finding }): CheckSite => {
  const engineRequest: EngineRequest = { catalogue: request.catalogue, clause: request.finding.clause, mechanism: request.finding.mechanism };
  const reading = symptomReadingOf({ catalogue: request.catalogue, finding: request.finding });
  return reading.reading === "named" ? siteOfSymptom({ ...engineRequest, symptom: reading.symptom }) : uncheckedSite(engineRequest);
};

export const nativeSitesOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly exception: NativeException & { readonly mechanism: MechanismId };
}): readonly CheckSite[] => {
  const engineRequest: EngineRequest = { catalogue: request.catalogue, clause: request.exception.clause, mechanism: request.exception.mechanism };
  const sites = sitesAtEngine(engineRequest);
  return sites.length === 0 ? [uncheckedSite(engineRequest)] : sites;
};

export const checkSiteText = (request: { readonly site: CheckSite }): string => {
  switch (request.site.sited) {
    case "check":
      return `${checkAddressOf({ check: request.site.check })} ${request.site.engine.name}`;
    case "unchecked":
      return `${clauseAddressText({ address: request.site.clause })} ${request.site.mechanism}`;
  }
};
