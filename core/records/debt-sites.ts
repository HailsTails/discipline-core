import type { Finding } from "../governance/governance.ts";
import { checkAddressOf } from "../symptom-catalogue/check-address.ts";
import type { SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { RepoPath } from "../values/repo-path.ts";
import { findingSitesOf, type RaisedFinding } from "./answering.ts";
import type { Site } from "./record-reach.ts";

export type DebtSite = { readonly address: string; readonly file: RepoPath };

const NOT_REPORTED: RaisedFinding["party"] = { reported: "not-reported" };

const addressOf = (request: { readonly site: Site }): string =>
  request.site.check.found === "check" ? checkAddressOf({ check: request.site.check.check }) : request.site.symptom.name;

const codePointOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left === request.right) {
    return 0;
  }
  return request.left < request.right ? -1 : 1;
};

const siteKey = (request: { readonly site: DebtSite }): string => `${request.site.file}\n${request.site.address}`;

export const debtSitesOf = (request: { readonly catalogue: SymptomCatalogue; readonly findings: readonly Finding[] }): readonly DebtSite[] => {
  const sites = request.findings
    .flatMap((finding) => findingSitesOf({ raised: { finding, party: NOT_REPORTED }, catalogue: request.catalogue }))
    .map((site): DebtSite => ({ address: addressOf({ site }), file: site.file }));
  const distinct = [...new Map(sites.map((site) => [siteKey({ site }), site])).values()];
  return distinct.toSorted((left, right) => codePointOrder({ left: siteKey({ site: left }), right: siteKey({ site: right }) }));
};
