import { clauseAddressText } from "../../values/clause-address.ts";
import type { RepoPath } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import type { ExceptionRecord } from "../version-one-records/exception-record.ts";
import type { HeadRecord } from "../version-one-head/head-records.ts";
import type { RecordInput } from "../version-two-mapping/records-mapping.ts";
import type { RecordAnswered } from "./carve-out-oracle.ts";

export type CarveOutUnanswered = { readonly kind: "carve-out-unanswered"; readonly clause: string; readonly file: RepoPath };

export type LocationUnanswered = { readonly kind: "location-unanswered"; readonly clause: string; readonly file: RepoPath };

export type Unanswered = CarveOutUnanswered | LocationUnanswered;

const answerGivenFor = (request: { readonly record: ExceptionRecord; readonly answered: readonly RecordAnswered[] }): RecordAnswered["answer"] | undefined =>
  request.answered.find((each) => each.record === request.record)?.answer;

const carveOutInputOf = (request: {
  readonly head: Extract<HeadRecord, { readonly kind: "file-carve-out" }>;
  readonly answered: readonly RecordAnswered[];
}): Result<RecordInput, CarveOutUnanswered> => {
  const { head } = request;
  const answer = answerGivenFor({ record: head.record, answered: request.answered });
  return answer === undefined || !("credit" in answer)
    ? { outcome: "failed", error: { kind: "carve-out-unanswered", clause: clauseAddressText({ address: head.record.clause }), file: head.record.file } }
    : { outcome: "ok", value: { ...head, answer } };
};

const locationInputOf = (request: {
  readonly head: Extract<HeadRecord, { readonly kind: "authorised-location" }>;
  readonly answered: readonly RecordAnswered[];
}): Result<RecordInput, LocationUnanswered> => {
  const { head } = request;
  const answer = answerGivenFor({ record: head.record, answered: request.answered });
  return answer === undefined || !("reach" in answer)
    ? { outcome: "failed", error: { kind: "location-unanswered", clause: clauseAddressText({ address: head.record.clause }), file: head.record.file } }
    : { outcome: "ok", value: { ...head, answer } };
};

const inputOf = (request: { readonly head: HeadRecord; readonly answered: readonly RecordAnswered[] }): Result<RecordInput, Unanswered> => {
  const { head, answered } = request;
  switch (head.kind) {
    case "file-carve-out":
      return carveOutInputOf({ head, answered });
    case "authorised-location":
      return locationInputOf({ head, answered });
    case "clause-wide-carve-out":
      return { outcome: "ok", value: head };
  }
};

export const recordInputsOf = (request: {
  readonly heads: readonly HeadRecord[];
  readonly answered: readonly RecordAnswered[];
}): Result<readonly RecordInput[], Unanswered> => {
  const inputs = request.heads.map((head) => inputOf({ head, answered: request.answered }));
  const failed = inputs.find((input) => input.outcome === "failed");
  return failed ?? { outcome: "ok", value: inputs.flatMap((input) => (input.outcome === "ok" ? [input.value] : [])) };
};
