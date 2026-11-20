import { type ClauseAddress, sameClauseAddress } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { Check, Symptom, SymptomCatalogue } from "./symptom-catalogue.ts";

export type FoundCheck = { readonly found: "check"; readonly check: Check } | { readonly found: "none" };

const NO_CHECK: FoundCheck = { found: "none" };

const foundAmong = (request: { readonly checks: readonly Check[] }): FoundCheck => {
  const [check] = request.checks;
  return check === undefined ? NO_CHECK : { found: "check", check };
};

export const checkAddressOf = (request: { readonly check: Check }): string => `${request.check.symptom.name}#${request.check.name}`;

export const checkAt = (request: { readonly catalogue: SymptomCatalogue; readonly address: string }): FoundCheck =>
  foundAmong({ checks: request.catalogue.checks.filter((candidate) => checkAddressOf({ check: candidate }) === request.address) });

export const checksOf = (request: { readonly catalogue: Pick<SymptomCatalogue, "checks">; readonly clause: ClauseAddress }): readonly Check[] =>
  request.catalogue.checks.filter((check) => sameClauseAddress({ left: check.clause, right: request.clause }) === "same");

export const checkOfSymptomAt = (request: {
  readonly catalogue: Pick<SymptomCatalogue, "checks">;
  readonly clause: ClauseAddress;
  readonly symptom: Symptom;
  readonly mechanism: MechanismId;
}): FoundCheck =>
  foundAmong({
    checks: checksOf(request).filter(
      (check) => check.symptom.name === request.symptom.name && check.engines.some((engine) => engine.mechanism === request.mechanism),
    ),
  });
