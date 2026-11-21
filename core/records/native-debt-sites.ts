import type { AttributedNativeException, GovernedRun } from "../governance/governance.ts";
import type { SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import { clauseAddressText } from "../values/clause-address.ts";
import type { RepoPath } from "../values/repo-path.ts";
import { nativeSitesOf } from "./answering.ts";
import { type DebtSite, debtSiteOf, inSiteOrder } from "./debt-sites.ts";
import type { UnrecordableSite } from "./unrecordable-site.ts";

export type NativeDebtSites = { readonly recordable: readonly DebtSite[]; readonly unrecordable: readonly UnrecordableSite[] };

const placeOf = (request: { readonly exception: AttributedNativeException }): RepoPath => {
  const { exception } = request;
  return exception.kind === "command-line-option" ? exception.location : exception.file;
};

const unrecordableOf = (request: { readonly exception: AttributedNativeException }): UnrecordableSite => ({
  address: request.exception.check ?? clauseAddressText({ address: request.exception.clause }),
  file: placeOf(request),
  because: request.exception.kind,
});

const classifiedOf = (request: {
  readonly exception: AttributedNativeException;
  readonly runs: readonly GovernedRun[];
  readonly catalogue: SymptomCatalogue;
}): NativeDebtSites => {
  const { exception, catalogue } = request;
  const run = request.runs.find((candidate) => candidate.mechanism === exception.mechanism);
  const sites = run === undefined ? [] : nativeSitesOf({ exception, run, catalogue });
  return sites.length === 0
    ? { recordable: [], unrecordable: [unrecordableOf({ exception })] }
    : { recordable: sites.map((site) => debtSiteOf({ site })), unrecordable: [] };
};

export const nativeDebtSitesOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly unrecorded: readonly AttributedNativeException[];
  readonly runs: readonly GovernedRun[];
}): NativeDebtSites => {
  const classified = request.unrecorded.map((exception) => classifiedOf({ ...request, exception }));
  return {
    recordable: inSiteOrder({ sites: classified.flatMap((entry) => entry.recordable) }),
    unrecordable: inSiteOrder({ sites: classified.flatMap((entry) => entry.unrecordable) }),
  };
};
