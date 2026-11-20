import { clauseAddressText } from "../../values/clause-address.ts";
import type { RepoPath } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import type { HeadRecord } from "../version-one-head/head-records.ts";
import type { RecordInput } from "../version-two-mapping/records-mapping.ts";
import type { CarveOutAnswered } from "./carve-out-oracle.ts";

export type CarveOutUnanswered = { readonly kind: "carve-out-unanswered"; readonly clause: string; readonly file: RepoPath };

const inputOf = (request: { readonly head: HeadRecord; readonly answered: readonly CarveOutAnswered[] }): Result<RecordInput, CarveOutUnanswered> => {
  const { head } = request;
  if (head.kind !== "file-carve-out") {
    return { outcome: "ok", value: head };
  }
  const found = request.answered.find((each) => each.record === head.record);
  return found === undefined
    ? { outcome: "failed", error: { kind: "carve-out-unanswered", clause: clauseAddressText({ address: head.record.clause }), file: head.record.file } }
    : { outcome: "ok", value: { ...head, answer: found.answer } };
};

export const recordInputsOf = (request: {
  readonly heads: readonly HeadRecord[];
  readonly answered: readonly CarveOutAnswered[];
}): Result<readonly RecordInput[], CarveOutUnanswered> => {
  const inputs = request.heads.map((head) => inputOf({ head, answered: request.answered }));
  const failed = inputs.find((input) => input.outcome === "failed");
  return failed ?? { outcome: "ok", value: inputs.flatMap((input) => (input.outcome === "ok" ? [input.value] : [])) };
};
