import { z } from "zod";
import { embeddedRunReportSchema, type SliceProblem } from "../mechanism-port/embedded-run-report-schema.ts";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import {
  type RunnerFailure,
  rejectedCall,
  runnerInvalidOutput,
} from "../mechanism-port/runner-failure.ts";
import type {
  LoadedRunner,
  ProjectionRequest,
  RunRequest,
} from "../mechanism-port/runner-module-schema.ts";
import {
  type Hit,
  type NativeException,
  type ProjectionState,
  type ProjectionWrite,
  runnerResultSchema,
} from "../mechanism-port/runner-result-schema.ts";
import { projectionWriteSchema } from "../mechanism-port/runner-result-schema.ts";
import { standaloneRunReportSchema } from "../mechanism-port/standalone-run-report-schema.ts";
import { clauseAddressText, sameClauseAddress } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";

export type MechanismRun = {
  readonly mechanism: MechanismId;
  readonly hits: readonly Hit[];
  readonly nativeExceptions: readonly NativeException[];
  readonly coverableKinds: readonly NativeException["kind"][];
  readonly projection: "none" | ProjectionState;
  readonly slices: readonly SliceProblem[];
  readonly unprojectedFolders: readonly RepoPath[];
};

const STANDALONE_COVERABLE_KINDS: readonly NativeException["kind"][] = ["inline-disable"];

export type MechanismRequest = {
  readonly runner: LoadedRunner;
  readonly mechanism: MechanismId;
  readonly run: RunRequest;
  readonly declaredConfigRoots: readonly RepoPath[];
  readonly records: readonly ExceptionRecord[];
};

export type MechanismProjectionRequest = {
  readonly runner: LoadedRunner;
  readonly request: ProjectionRequest;
};

const standaloneResultSchema = runnerResultSchema({ value: standaloneRunReportSchema });

type FiledClause = Pick<Hit, "clause" | "file">;

const unrequestedHit = <Filed extends FiledClause>(request: {
  readonly hits: readonly Filed[];
  readonly run: RunRequest;
  readonly checkedFiles: readonly RepoPath[];
}): Filed | undefined =>
  request.hits.find(
    (hit) =>
      !request.checkedFiles.includes(hit.file) ||
      !request.run.clauses.some(
        (clause) => sameClauseAddress({ left: clause.address, right: hit.clause }) === "same",
      ),
  );

const okOutcomeSchema = z.object({ outcome: z.literal("ok") });

const okStandaloneSchema = z.object({ outcome: z.literal("ok"), value: standaloneRunReportSchema });

const invalidStandaloneDetail = (request: { readonly returned: unknown; readonly error: z.ZodError }): string => {
  if (!okOutcomeSchema.safeParse(request.returned).success) {
    return z.prettifyError(request.error);
  }
  const report = okStandaloneSchema.safeParse(request.returned);
  return z.prettifyError(report.success ? request.error : report.error);
};

const standaloneRun = (request: {
  readonly returned: unknown;
  readonly mechanism: MechanismId;
  readonly run: RunRequest;
}): Result<MechanismRun, RunnerFailure> => {
  const parsed = standaloneResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return runnerInvalidOutput({ detail: invalidStandaloneDetail({ returned: request.returned, error: parsed.error }) });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  const report = parsed.data.value;
  const unrequested = unrequestedHit({ hits: report.hits, run: request.run, checkedFiles: request.run.trackedPaths });
  if (unrequested !== undefined) {
    return runnerInvalidOutput({
      detail: `a hit names ${clauseAddressText({ address: unrequested.clause })} in ${unrequested.file}, which the request did not hold`,
    });
  }
  const unrequestedInline = unrequestedHit({ hits: report.nativeExceptions, run: request.run, checkedFiles: request.run.trackedPaths });
  if (unrequestedInline !== undefined) {
    return runnerInvalidOutput({
      detail: `a native exception names ${clauseAddressText({ address: unrequestedInline.clause })} in ${unrequestedInline.file}, which the request did not hold`,
    });
  }
  return {
    outcome: "ok",
    value: {
      mechanism: request.mechanism,
      hits: report.hits,
      nativeExceptions: report.nativeExceptions,
      coverableKinds: STANDALONE_COVERABLE_KINDS,
      projection: "none",
      slices: [],
      unprojectedFolders: [],
    },
  };
};

const reportResultSchema = runnerResultSchema({ value: embeddedRunReportSchema });

const projectionWriteResultSchema = runnerResultSchema({ value: z.array(projectionWriteSchema).readonly() });

const unrequestedNativeException = (request: {
  readonly nativeExceptions: readonly NativeException[];
  readonly run: RunRequest;
}): NativeException | undefined =>
  request.nativeExceptions.find(
    (nativeException) =>
      !request.run.clauses.some(
        (clause) =>
          sameClauseAddress({ left: clause.address, right: nativeException.clause }) === "same",
      ),
  );

const embeddedRun = (request: {
  readonly returned: unknown;
  readonly mechanism: MechanismId;
  readonly projectedKinds: readonly NativeException["kind"][];
  readonly run: RunRequest;
}): Result<MechanismRun, RunnerFailure> => {
  const parsed = reportResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return runnerInvalidOutput({ detail: z.prettifyError(parsed.error) });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  const report = parsed.data.value;
  const unrequested = unrequestedHit({ hits: report.hits, run: request.run, checkedFiles: request.run.files });
  if (unrequested !== undefined) {
    return runnerInvalidOutput({
      detail: `a hit names ${clauseAddressText({ address: unrequested.clause })} in ${unrequested.file}, which the request did not hold`,
    });
  }
  const unrequestedNative = unrequestedNativeException({
    nativeExceptions: report.nativeExceptions,
    run: request.run,
  });
  if (unrequestedNative !== undefined) {
    return runnerInvalidOutput({
      detail: `a native exception names ${clauseAddressText({ address: unrequestedNative.clause })}, which the request did not hold`,
    });
  }
  return {
    outcome: "ok",
    value: {
      mechanism: request.mechanism,
      hits: report.hits,
      nativeExceptions: report.nativeExceptions,
      coverableKinds: request.projectedKinds,
      projection: report.projection,
      slices: report.slices,
      unprojectedFolders: report.unprojectedFolders,
    },
  };
};

const embeddedProjection = (request: {
  readonly returned: unknown;
}): Result<readonly ProjectionWrite[], RunnerFailure> => {
  const parsed = projectionWriteResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return runnerInvalidOutput({ detail: z.prettifyError(parsed.error) });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  return parsed.data;
};

export const runMechanism = (
  request: MechanismRequest,
): Promise<Result<MechanismRun, RunnerFailure>> => {
  switch (request.runner.exceptionPath) {
    case "standalone": {
      const runner = request.runner;
      return Promise.resolve()
        .then(() => runner.run(request.run))
        .then(
          (returned) => standaloneRun({ returned, mechanism: request.mechanism, run: request.run }),
          (thrown: unknown) => rejectedCall({ thrown }),
        );
    }
    case "embedded": {
      const runner = request.runner;
      return Promise.resolve()
        .then(() =>
          runner.run({ ...request.run, declaredConfigRoots: request.declaredConfigRoots, records: request.records }),
        )
        .then(
          (returned) =>
            embeddedRun({
              returned,
              mechanism: request.mechanism,
              projectedKinds: runner.projectedKinds,
              run: request.run,
            }),
          (thrown: unknown) => rejectedCall({ thrown }),
        );
    }
  }
};

export const projectMechanism = (
  request: MechanismProjectionRequest,
): Promise<Result<readonly ProjectionWrite[], RunnerFailure>> => {
  switch (request.runner.exceptionPath) {
    case "standalone": {
      return Promise.resolve({ outcome: "ok", value: [] });
    }
    case "embedded": {
      const runner = request.runner;
      return Promise.resolve()
        .then(() => runner.project(request.request))
        .then(
          (returned) => embeddedProjection({ returned }),
          (thrown: unknown) => rejectedCall({ thrown }),
        );
    }
  }
};
