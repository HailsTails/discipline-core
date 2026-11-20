import type { MisnamedRuleId } from "../mechanism-port/checks-runner-types.ts";
import { onOneLine } from "./printed-text.ts";

export const misnamedLine = (request: { readonly misnamed: MisnamedRuleId }): string =>
  `${request.misnamed.file}:${request.misnamed.line} ${request.misnamed.kind} ${request.misnamed.ruleId} ${onOneLine({ text: request.misnamed.text })}`;
