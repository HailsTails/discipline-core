import type { RepoPath } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import type { ExceptionRecord } from "../version-one-records/exception-record.ts";
import type { CarveOutAnswer, LocationAnswer } from "../version-two-mapping/records-mapping.ts";

export type FileCarveOutRecord = Extract<ExceptionRecord, { readonly kind: "file-carve-out" }>;

export type AuthorisedLocationRecord = Extract<ExceptionRecord, { readonly kind: "authorised-location" }>;

export type CarveOutAnswered = { readonly record: FileCarveOutRecord; readonly answer: CarveOutAnswer };

export type ProjectionNotCurrentState = "out-of-date" | "missing" | "not-applied" | "not-included" | "unconfigured";

export type LocationAnswered = { readonly record: AuthorisedLocationRecord; readonly answer: LocationAnswer };

export type RecordAnswered = CarveOutAnswered | LocationAnswered;

export type OracleFailure =
  | { readonly kind: "version-one-run-failed"; readonly detail: string }
  | { readonly kind: "projection-not-current"; readonly file: RepoPath; readonly state: ProjectionNotCurrentState }
  | { readonly kind: "finding-not-attributable"; readonly clause: string; readonly file: RepoPath; readonly check: string | undefined }
  | { readonly kind: "record-doubly-held"; readonly clause: string; readonly file: RepoPath };

export type RecordAnswerOracle = {
  readonly answer: (request: { readonly records: readonly ExceptionRecord[] }) => Promise<Result<readonly RecordAnswered[], OracleFailure>>;
};
