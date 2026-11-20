import { type ClauseAddress, sameClauseAddress } from "../values/clause-address.ts";
import type { Check, SymptomCatalogue } from "./symptom-catalogue.ts";

export type CheckAtAddress = { readonly found: "check"; readonly check: Check } | { readonly found: "none" };

export const checkAddressOf = (request: { readonly check: Check }): string => `${request.check.symptom.name}#${request.check.name}`;

export const checkAt = (request: { readonly catalogue: SymptomCatalogue; readonly address: string }): CheckAtAddress => {
  const check = request.catalogue.checks.find((candidate) => checkAddressOf({ check: candidate }) === request.address);
  return check === undefined ? { found: "none" } : { found: "check", check };
};

export const checksOf = (request: { readonly catalogue: Pick<SymptomCatalogue, "checks">; readonly clause: ClauseAddress }): readonly Check[] =>
  request.catalogue.checks.filter((check) => sameClauseAddress({ left: check.clause, right: request.clause }) === "same");
