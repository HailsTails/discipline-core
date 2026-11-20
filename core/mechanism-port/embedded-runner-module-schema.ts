import type { z } from "zod";
import type { ExceptionRecord } from "../upgrade/version-one-records/exception-records.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import type { Equal } from "../values/type-equality.ts";
import type { ReturnedEmbeddedRunReport } from "./embedded-run-report-schema.ts";
import type { RunnerFailure } from "./runner-failure.ts";
import type {
  embeddedRunnerModuleSchema,
  ProjectionRequest,
  RunRequest,
  StandaloneRunner,
} from "./runner-module-schema.ts";
import type { NativeException, ProjectionWrite } from "./runner-result-schema.ts";

export type EmbeddedRunRequest = RunRequest & {
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly records: readonly ExceptionRecord[];
};

export type EmbeddedRunner = {
  readonly exceptionPath: "embedded";
  readonly projectedKinds: readonly NativeException["kind"][];
  readonly run: (request: EmbeddedRunRequest) => Promise<Result<ReturnedEmbeddedRunReport, RunnerFailure>>;
  readonly conform: StandaloneRunner["conform"];
  readonly project: (
    request: ProjectionRequest,
  ) => Promise<Result<readonly ProjectionWrite[], RunnerFailure>>;
};

export const isEmbeddedKeySetEqual: Equal<
  keyof EmbeddedRunner,
  keyof z.output<typeof embeddedRunnerModuleSchema>
> = true;

export const isEmbeddedExceptionPathEqual: Equal<
  EmbeddedRunner["exceptionPath"],
  z.output<typeof embeddedRunnerModuleSchema>["exceptionPath"]
> = true;
