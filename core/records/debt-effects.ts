import { checkAddressOf } from "../symptom-catalogue/check-address.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { DebtSite } from "./debt-sites.ts";
import type { Debt, PlacedRecord } from "./hone-record.ts";

export type DebtEffect =
  | { readonly effect: "recorded" }
  | { readonly effect: "already-recorded"; readonly heldIn: RepoPath }
  | { readonly effect: "left"; readonly under: RepoPath }
  | { readonly effect: "new-file" }
  | { readonly effect: "touched" };

export type DebtOutcome = DebtSite & DebtEffect;

export type DebtEffectsRequest = {
  readonly sites: readonly DebtSite[];
  readonly records: readonly PlacedRecord[];
  readonly leave: readonly RepoPath[];
  readonly inBase: ReadonlySet<RepoPath>;
  readonly touched: ReadonlySet<RepoPath>;
};

type HeldDebt = { readonly place: PlacedRecord["place"]; readonly debt: Debt };

export const debtAddressOf = (request: { readonly debt: Debt }): string =>
  request.debt.reach.reaches === "one-check" ? checkAddressOf({ check: request.debt.reach.check }) : request.debt.symptom.name;

const heldDebtsIn = (request: { readonly records: readonly PlacedRecord[] }): readonly HeldDebt[] =>
  request.records.flatMap((placed) => (placed.record.kind === "debt" ? [{ place: placed.place, debt: placed.record }] : []));

const leavingPath = (request: { readonly file: RepoPath; readonly leave: readonly RepoPath[] }): RepoPath | undefined =>
  request.leave.find((path) => request.file === path || request.file.startsWith(`${path}/`));

const effectOf = (request: { readonly site: DebtSite; readonly held: readonly HeldDebt[]; readonly rest: Omit<DebtEffectsRequest, "sites" | "records"> }): DebtEffect => {
  const { site, held, rest } = request;
  const heldHere = held.find((candidate) => candidate.debt.file === site.file && debtAddressOf({ debt: candidate.debt }) === site.address);
  if (heldHere !== undefined) {
    return { effect: "already-recorded", heldIn: heldHere.place.file };
  }
  const under = leavingPath({ file: site.file, leave: rest.leave });
  if (under !== undefined) {
    return { effect: "left", under };
  }
  if (!rest.inBase.has(site.file)) {
    return { effect: "new-file" };
  }
  return rest.touched.has(site.file) ? { effect: "touched" } : { effect: "recorded" };
};

export const debtOutcomesOf = (request: DebtEffectsRequest): readonly DebtOutcome[] => {
  const held = heldDebtsIn(request);
  return request.sites.map((site) => ({ ...site, ...effectOf({ site, held, rest: request }) }));
};
