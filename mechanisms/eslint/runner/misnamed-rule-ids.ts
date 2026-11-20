import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { MisnamedRuleId } from "./checks-run-types.ts";
import type { LintedMessage } from "./eslint-instance.ts";
import { MISNAMED_DISABLE_RULE_ID, namedRuleIdsOf, OWN_RULE_ID_PREFIX } from "./misnamed-disable-rule.ts";

const LINE_COMMENT = "//";

const BLOCK_OPEN = "/*";

const BLOCK_CLOSE = "*/";

const commentValueOf = (request: { readonly text: string }): string => {
  if (request.text.startsWith(LINE_COMMENT)) {
    return request.text.slice(LINE_COMMENT.length);
  }
  return request.text.startsWith(BLOCK_OPEN) && request.text.endsWith(BLOCK_CLOSE) ? request.text.slice(BLOCK_OPEN.length, -BLOCK_CLOSE.length) : request.text;
};

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
