import type { PlacedRecord } from "../records/hone-record.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import { computeTouchedSet, type TouchedSet } from "../touched-set/touched-set.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Assessment } from "../values/assessment.ts";

const NOTHING_TOUCHED: TouchedSet = { measured: "yes", paths: new Set() };

const ELSEWHERE: TouchedSet = { measured: "elsewhere" };

const holdsDebt = (request: { readonly records: readonly PlacedRecord[] }): "holds-debt" | "holds-none" =>
  request.records.some((placed) => placed.record.kind === "debt") ? "holds-debt" : "holds-none";

export const touchedSetOf = (request: {
  readonly assessment: Assessment;
  readonly records: readonly PlacedRecord[];
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: Pick<GitPort, "changedSince">;
}): TouchedSet => {
  if (request.assessment.forfeiture === "elsewhere") {
    return ELSEWHERE;
  }
  return holdsDebt(request) === "holds-debt" ? computeTouchedSet(request) : NOTHING_TOUCHED;
};
