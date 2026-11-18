import type { AttributedNativeException, Finding } from "../governance/governance.ts";
import { type ClauseAddress, clauseAddressSchema, clauseAddressText } from "../values/clause-address.ts";
import type { RepoPath } from "../values/repo-path.ts";
import { TOOL_IDENTITY } from "../values/tool-identity.ts";
import type { FileCarveOutEntry } from "./exception-record.ts";
import type { StructuralExceptionEntry } from "./exception-records.ts";

export const RECORD_DEBT_SUBCOMMAND = "record-debt";

export const INHERITED_DEBT_REASON = `Inherited debt: this file was already in the repository before ${TOOL_IDENTITY.name} was adopted, and broke this clause when ${TOOL_IDENTITY.command} ${RECORD_DEBT_SUBCOMMAND} wrote this record. Nobody has reviewed it or decided it should stay. The record is forfeited when the file next changes.`;

type DebtPair = {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
};

export type InheritedDebtOutcome =
  | (DebtPair & { readonly effect: "recorded" | "already-recorded" | "new-file" | "refused" })
  | (DebtPair & { readonly effect: "left"; readonly under: RepoPath });

export type InheritedDebtRequest = {
  readonly findings: readonly Finding[];
  readonly unrecorded: readonly AttributedNativeException[];
  readonly existing: readonly StructuralExceptionEntry[];
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

const recordedPairKeys = (request: { readonly existing: readonly StructuralExceptionEntry[] }): ReadonlySet<string> =>
  new Set(
    request.existing.flatMap((entry) => {
      if (entry.kind === "clause-wide-carve-out") {
        return [];
      }
      const clause = clauseAddressSchema.safeParse(entry.clause);
      return clause.success ? [`${clauseAddressText({ address: clause.data })} ${entry.file}`] : [];
    }),
  );

const leavingPath = (request: { readonly file: RepoPath; readonly leave: readonly RepoPath[] }): RepoPath | undefined =>
  request.leave.find((path) => request.file === path || request.file.startsWith(`${path}/`));

const outcomeOf = (request: {
  readonly pair: DebtPair;
  readonly debt: InheritedDebtRequest;
  readonly recorded: ReadonlySet<string>;
  readonly refusing: ReadonlySet<string>;
}): InheritedDebtOutcome => {
  const { pair, debt } = request;
  if (request.refusing.has(clauseAddressText({ address: pair.clause }))) {
    return { ...pair, effect: "refused" };
  }
  if (request.recorded.has(pairKey(pair))) {
    return { ...pair, effect: "already-recorded" };
  }
  const under = leavingPath({ file: pair.file, leave: debt.leave });
  if (under !== undefined) {
    return { ...pair, effect: "left", under };
  }
  return { ...pair, effect: debt.inBase.has(pair.file) ? "recorded" : "new-file" };
};

export const inheritedDebtOf = (request: InheritedDebtRequest): readonly InheritedDebtOutcome[] => {
  const recorded = recordedPairKeys(request);
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
      ? [{ kind: "file-carve-out", clause: clauseAddressText({ address: outcome.clause }), file: outcome.file, reason: INHERITED_DEBT_REASON }]
      : [],
  );
