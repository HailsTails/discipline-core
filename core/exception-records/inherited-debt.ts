import type { AttributedNativeException, Finding } from "../governance/governance.ts";
import { type ClauseAddress, clauseAddressSchema, clauseAddressText } from "../values/clause-address.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { FileCarveOutEntry } from "./exception-record.ts";
import type { PlacedEntry } from "./exception-records.ts";

export const RECORD_DEBT_SUBCOMMAND = "record-debt";

type DebtPair = {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
};

export type InheritedDebtOutcome =
  | (DebtPair & { readonly effect: "recorded" | "new-file" | "refused" })
  | (DebtPair & { readonly effect: "already-recorded"; readonly heldIn: RepoPath })
  | (DebtPair & { readonly effect: "left"; readonly under: RepoPath });

export type InheritedDebtRequest = {
  readonly findings: readonly Finding[];
  readonly unrecorded: readonly AttributedNativeException[];
  readonly existing: readonly PlacedEntry[];
  readonly leave: readonly RepoPath[];
  readonly inBase: ReadonlySet<RepoPath>;
  readonly refusing: readonly ClauseAddress[];
};

const pairKey = (request: DebtPair): string => `${clauseAddressText({ address: request.clause })} ${request.file}`;

const inlinePairs = (request: { readonly unrecorded: readonly AttributedNativeException[] }): readonly DebtPair[] =>
  request.unrecorded.flatMap((exception) =>
    exception.kind === "inline-disable" ? [{ clause: exception.clause, file: exception.file }] : [],
  );

const textOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left === request.right) {
    return 0;
  }
  return request.left < request.right ? -1 : 1;
};

const pairOrder = (request: { readonly left: DebtPair; readonly right: DebtPair }): number =>
  request.left.file === request.right.file
    ? textOrder({ left: clauseAddressText({ address: request.left.clause }), right: clauseAddressText({ address: request.right.clause }) })
    : textOrder({ left: request.left.file, right: request.right.file });

const distinctPairs = (request: { readonly pairs: readonly DebtPair[] }): readonly DebtPair[] =>
  [...new Map(request.pairs.map((pair) => [pairKey(pair), { clause: pair.clause, file: pair.file }])).values()].toSorted(
    (left, right) => pairOrder({ left, right }),
  );

const recordedPairFiles = (request: { readonly existing: readonly PlacedEntry[] }): ReadonlyMap<string, RepoPath> =>
  new Map(
    request.existing
      .flatMap(({ entry, place }): readonly (readonly [string, RepoPath])[] => {
        if (entry.kind === "clause-wide-carve-out") {
          return [];
        }
        const clause = clauseAddressSchema.safeParse(entry.clause);
        return clause.success ? [[`${clauseAddressText({ address: clause.data })} ${entry.file}`, place.file]] : [];
      })
      .toReversed(),
  );

const leavingPath = (request: { readonly file: RepoPath; readonly leave: readonly RepoPath[] }): RepoPath | undefined =>
  request.leave.find((path) => request.file === path || request.file.startsWith(`${path}/`));

const outcomeOf = (request: {
  readonly pair: DebtPair;
  readonly debt: InheritedDebtRequest;
  readonly recorded: ReadonlyMap<string, RepoPath>;
  readonly refusing: ReadonlySet<string>;
}): InheritedDebtOutcome => {
  const { pair, debt } = request;
  if (request.refusing.has(clauseAddressText({ address: pair.clause }))) {
    return { ...pair, effect: "refused" };
  }
  const heldIn = request.recorded.get(pairKey(pair));
  if (heldIn !== undefined) {
    return { ...pair, effect: "already-recorded", heldIn };
  }
  const under = leavingPath({ file: pair.file, leave: debt.leave });
  if (under !== undefined) {
    return { ...pair, effect: "left", under };
  }
  return { ...pair, effect: debt.inBase.has(pair.file) ? "recorded" : "new-file" };
};

export const inheritedDebtOf = (request: InheritedDebtRequest): readonly InheritedDebtOutcome[] => {
  const recorded = recordedPairFiles(request);
  const refusing = new Set(request.refusing.map((address) => clauseAddressText({ address })));
  const findingPairs = request.findings.map((finding) => ({ clause: finding.clause, file: finding.file }));
  return distinctPairs({ pairs: [...findingPairs, ...inlinePairs(request)] }).map((pair) =>
    outcomeOf({ pair, debt: request, recorded, refusing }),
  );
};

export const inheritedDebtEntriesOf = (request: {
  readonly outcomes: readonly InheritedDebtOutcome[];
}): readonly FileCarveOutEntry[] =>
  request.outcomes.flatMap((outcome) =>
    outcome.effect === "recorded"
      ? [{ kind: "file-carve-out", clause: clauseAddressText({ address: outcome.clause }), file: outcome.file }]
      : [],
  );
