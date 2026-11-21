import type { Finding } from "../governance/governance.ts";
import { checkAddressOf } from "../symptom-catalogue/check-address.ts";
import type { SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import { clauseAddressText } from "../values/clause-address.ts";
import type { RepoPath } from "../values/repo-path.ts";
import { findingSitesOf, type RaisedFinding } from "./answering.ts";
import { codePointOrder } from "./code-point-order.ts";
import type { Site } from "./record-reach.ts";
import type { UnrecordableSite } from "./unrecordable-site.ts";

export type DebtSite = { readonly address: string; readonly file: RepoPath };

const NOT_REPORTED: RaisedFinding["party"] = { reported: "not-reported" };

const NO_REASON = "";

const addressOf = (request: { readonly site: Site }): string =>
  request.site.check.found === "check" ? checkAddressOf({ check: request.site.check.check }) : request.site.symptom.name;

const siteKey = (request: { readonly site: DebtSite & { readonly because?: string } }): string =>
  `${request.site.file}\n${request.site.address}\n${request.site.because ?? NO_REASON}`;

export const inSiteOrder = <Placed extends DebtSite>(request: { readonly sites: readonly Placed[] }): readonly Placed[] => {
  const distinct = [...new Map(request.sites.map((site) => [siteKey({ site }), site])).values()];
  return distinct.toSorted((left, right) => codePointOrder({ left: siteKey({ site: left }), right: siteKey({ site: right }) }));
};

export const debtSiteOf = (request: { readonly site: Site }): DebtSite => ({ address: addressOf(request), file: request.site.file });

export const sitesOfFinding = (request: { readonly catalogue: SymptomCatalogue; readonly finding: Finding }): readonly Site[] =>
  findingSitesOf({ raised: { finding: request.finding, party: NOT_REPORTED }, catalogue: request.catalogue });

export const debtSitesOf = (request: { readonly catalogue: SymptomCatalogue; readonly findings: readonly Finding[] }): readonly DebtSite[] =>
  inSiteOrder({ sites: request.findings.flatMap((finding) => sitesOfFinding({ catalogue: request.catalogue, finding })).map((site) => debtSiteOf({ site })) });

export const unrecordableSitesOf = (request: { readonly catalogue: SymptomCatalogue; readonly findings: readonly Finding[] }): readonly UnrecordableSite[] =>
  inSiteOrder({
    sites: request.findings
      .filter((finding) => sitesOfFinding({ catalogue: request.catalogue, finding }).length === 0)
      .map((finding): UnrecordableSite => ({ address: clauseAddressText({ address: finding.clause }), file: finding.file, because: "no-check" })),
  });
