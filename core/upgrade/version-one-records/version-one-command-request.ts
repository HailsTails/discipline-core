import type { CommandRequest } from "../../command-line/command-request.ts";
import type { ExceptionRepositoryOf } from "./exception-records.ts";

export type VersionOneCommandRequest = CommandRequest & {
  readonly exceptionRepositoryOf: ExceptionRepositoryOf;
};
