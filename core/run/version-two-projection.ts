import type { ProjectedFile } from "../mechanism-port/checks-runner-types.ts";
import type { RunLoadFailure } from "../report/run-load-failure.ts";
import type { Result } from "../values/result.ts";
import { type VersionTwoStages, versionTwoInputsOf } from "./version-two-run.ts";

export const versionTwoProjectionOver = async (request: { readonly stages: VersionTwoStages }): Promise<Result<readonly ProjectedFile[], RunLoadFailure>> => {
  const inputs = versionTwoInputsOf(request);
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const tree = request.stages.tree({ settings: inputs.value.settings });
  return tree.outcome === "failed" ? tree : request.stages.projections({ ...inputs.value, tree: tree.value });
};
