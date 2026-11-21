import type { RepoPath } from "../../../core/values/repo-path.ts";
import { commentValueOf } from "./checks-comment-value.ts";
import type { MisnamedRuleId, VersionOneRuleId } from "./checks-run-types.ts";
import type { LintedMessage } from "./eslint-instance.ts";
import { MISNAMED_DISABLE_RULE_ID, namedRuleIdsOf, OWN_RULE_ID_PREFIX } from "./misnamed-disable-rule.ts";

type Misnaming = Pick<MisnamedRuleId, "kind" | "replacedBy"> | "named-right";

const NAMES_NO_CHECK: Misnaming = { kind: "names-no-check", replacedBy: [] };

const misnamingOf = (request: {
  readonly ruleId: string;
  readonly checkRuleIds: readonly string[];
  readonly versionOneRuleIds: readonly VersionOneRuleId[];
}): Misnaming => {
  if (!request.ruleId.startsWith(OWN_RULE_ID_PREFIX) || request.checkRuleIds.includes(request.ruleId)) {
    return "named-right";
  }
  const versionOne = request.versionOneRuleIds.find((candidate) => candidate.ruleId === request.ruleId);
  return versionOne === undefined || versionOne.replacedBy.length === 0 ? NAMES_NO_CHECK : { kind: "version-1-id", replacedBy: versionOne.replacedBy };
};

export const misnamedRuleIdsIn = (request: {
  readonly file: RepoPath;
  readonly messages: readonly LintedMessage[];
  readonly checkRuleIds: readonly string[];
  readonly versionOneRuleIds: readonly VersionOneRuleId[];
}): readonly MisnamedRuleId[] =>
  request.messages
    .filter((message) => message.ruleId === MISNAMED_DISABLE_RULE_ID)
    .flatMap((message) =>
      namedRuleIdsOf({ value: commentValueOf({ text: message.message }) }).flatMap((ruleId) => {
        const misnaming = misnamingOf({ ruleId, checkRuleIds: request.checkRuleIds, versionOneRuleIds: request.versionOneRuleIds });
        return misnaming === "named-right" ? [] : [{ ...misnaming, ruleId, file: request.file, line: message.line, text: message.message }];
      }),
    );
