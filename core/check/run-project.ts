import { type ExceptionRecord, UNMEASURED_EXCEPTION_BASELINE } from "../exception-records/exception-records.ts";
import type { ProjectionRequest } from "../mechanism-port/runner-module-schema.ts";
import type { ProjectionWrite } from "../mechanism-port/runner-result-schema.ts";
import type { Result } from "../values/result.ts";
import type { LoadFailure } from "./load-failure.ts";
import { projectMechanism } from "./mechanism-dispatch.ts";
import {
  allOk,
  type CheckedTree,
  type CheckRequest,
  checkedTreeOf,
  type LoadedMechanism,
  loadInputs,
  recordsOf,
  runnerFailed,
} from "./run-check.ts";

export type ProjectRequest = Omit<CheckRequest, "baseRevision" | "assessment">;

type ProjectionInputs = {
  readonly project: ProjectRequest;
  readonly records: readonly ExceptionRecord[];
  readonly tree: CheckedTree;
  readonly loaded: LoadedMechanism;
};

const projectionRequestOf = (request: ProjectionInputs): ProjectionRequest => ({
  repoRoot: request.project.repoRoot,
  installRoot: request.project.installRoot,
  trackedPaths: request.tree.tracked,
  declaredConfigRoots: request.tree.declaredConfigRoots,
  clauses: request.loaded.clauses,
  records: recordsOf({ records: request.records, mechanism: request.loaded.mechanism }),
});

const projectionWritesOf = (request: ProjectionInputs): Promise<Result<readonly ProjectionWrite[], LoadFailure>> =>
  projectMechanism({ runner: request.loaded.runner, request: projectionRequestOf(request) }).then(
    (runnerResult) => runnerFailed({ mechanism: request.loaded.mechanism, runnerResult }),
  );

export const runProject = async (
  request: ProjectRequest,
): Promise<Result<readonly ProjectionWrite[], LoadFailure>> => {
  const inputs = await loadInputs({ ...request, exceptionBaselineOf: () => UNMEASURED_EXCEPTION_BASELINE });
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const tree = checkedTreeOf({ check: request, inputs: inputs.value });
  if (tree.outcome === "failed") {
    return tree;
  }
  const writes = allOk({
    results: await Promise.all(
      inputs.value.mechanisms.map((loaded) =>
        projectionWritesOf({ project: request, records: inputs.value.records, tree: tree.value, loaded }),
      ),
    ),
  });
  if (writes.outcome === "failed") {
    return writes;
  }
  return { outcome: "ok", value: writes.value.flat() };
};
