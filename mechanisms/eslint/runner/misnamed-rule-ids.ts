import type { RepoPath } from "../../../core/values/repo-path.ts";
import { commentValueOf } from "./checks-comment-value.ts";
import type { MisnamedRuleId } from "./checks-run-types.ts";
import type { LintedMessage } from "./eslint-instance.ts";
import { MISNAMED_DISABLE_RULE_ID, namedRuleIdsOf, OWN_RULE_ID_PREFIX } from "./misnamed-disable-rule.ts";

const misnamingOf = (request: {
  readonly ruleId: string;
  readonly checkRuleIds: readonly string[];
  readonly versionOneRuleIds: readonly string[];
}): MisnamedRuleId["kind"] | "named-right" => {
  if (!request.ruleId.startsWith(OWN_RULE_ID_PREFIX) || request.checkRuleIds.includes(request.ruleId)) {
    return "named-right";
  }
  return request.versionOneRuleIds.includes(request.ruleId) ? "version-1-id" : "names-no-check";
};

export const misnamedRuleIdsIn = (request: {
  readonly file: RepoPath;
  readonly messages: readonly LintedMessage[];
  readonly checkRuleIds: readonly string[];
  readonly versionOneRuleIds: readonly string[];
}): readonly MisnamedRuleId[] =>
  request.messages
    .filter((message) => message.ruleId === MISNAMED_DISABLE_RULE_ID)
    .flatMap((message) =>
      namedRuleIdsOf({ value: commentValueOf({ text: message.message }) }).flatMap((ruleId) => {
        const kind = misnamingOf({ ruleId, checkRuleIds: request.checkRuleIds, versionOneRuleIds: request.versionOneRuleIds });
        return kind === "named-right" ? [] : [{ kind, ruleId, file: request.file, line: message.line, text: message.message }];
      }),
    );
