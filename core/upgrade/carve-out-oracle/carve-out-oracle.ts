import type { RepoPath } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import type { ExceptionRecord } from "../version-one-records/exception-record.ts";
import type { CarveOutAnswer } from "../version-two-mapping/records-mapping.ts";

export type FileCarveOutRecord = Extract<ExceptionRecord, { readonly kind: "file-carve-out" }>;

export type CarveOutAnswered = { readonly record: FileCarveOutRecord; readonly answer: CarveOutAnswer };

export type OracleFailure =
  | { readonly kind: "version-one-run-failed"; readonly detail: string }
  | { readonly kind: "finding-not-attributable"; readonly clause: string; readonly file: RepoPath; readonly check: string | undefined }
  | { readonly kind: "record-doubly-held"; readonly clause: string; readonly file: RepoPath };

export type CarveOutOracle = {
  readonly answer: (request: { readonly records: readonly ExceptionRecord[] }) => Promise<Result<readonly CarveOutAnswered[], OracleFailure>>;
};
