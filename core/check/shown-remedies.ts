import type { ClauseRoot } from "../consumer-selection/selection.ts";
import type { Finding } from "../governance/governance.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { clauseAddressText } from "../values/clause-address.ts";
import type { PackageLink } from "../command-line/package-link.ts";
import { shownPathOf } from "../command-line/shown-path.ts";

type ShownRemedyRequest = {
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly link: PackageLink;
  readonly clauseRoots: readonly ClauseRoot[];
};

const ruleFolderOf = (request: ShownRemedyRequest & { readonly finding: Finding }): string | undefined => {
  const clause = clauseAddressText({ address: request.finding.clause });
  const root = request.clauseRoots.find((candidate) => clauseAddressText({ address: candidate.clause }) === clause);
  return root === undefined ? undefined : request.path.join({ segments: [root.ruleSetRoot, "rules", root.clause.discipline] });
};

const shownRemedyOf = (request: ShownRemedyRequest & { readonly finding: Finding }): Finding => {
  const { remedy, ...located } = request.finding;
  if (remedy === undefined) {
    return request.finding;
  }
  const ruleFolder = ruleFolderOf(request);
  if (ruleFolder === undefined) {
    return located;
  }
  const page = shownPathOf({ ...request, target: request.path.join({ segments: [ruleFolder, remedy.page] }) });
  return { ...located, remedy: { ...remedy, page } };
};

export const shownRemediesOf = (request: ShownRemedyRequest & { readonly findings: readonly Finding[] }): readonly Finding[] =>
  request.findings.map((finding) => shownRemedyOf({ ...request, finding }));
