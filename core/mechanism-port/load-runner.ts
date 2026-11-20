import { z } from "zod";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { MechanismId } from "../values/identifiers.ts";
import { type ModuleExtension, runnerModuleSegmentsOf } from "../values/install-layout.ts";
import type { Result } from "../values/result.ts";
import { type LoadedRunner, runnerModuleSchema } from "./runner-module-schema.ts";

export type RunnerLocation = {
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly mechanism: MechanismId;
};

export type RunnerInvalid = {
  readonly kind: "runner-invalid";
  readonly mechanism: MechanismId;
  readonly detail: string;
};

const runnerExportSchema = z.object({ runner: runnerModuleSchema });

const runnerInvalid = (request: { readonly mechanism: MechanismId; readonly detail: string }): Result<never, RunnerInvalid> => ({
  outcome: "failed",
  error: { kind: "runner-invalid", ...request },
});

export const loadRunner = async (request: RunnerLocation): Promise<Result<LoadedRunner, RunnerInvalid>> => {
  const loaded = await request.modules.load({
    path: request.path.join({
      segments: runnerModuleSegmentsOf({ installRoot: request.installRoot, mechanism: request.mechanism, moduleExtension: request.moduleExtension }),
    }),
  });
  if (loaded.outcome === "failed") {
    return runnerInvalid({ mechanism: request.mechanism, detail: loaded.error.detail });
  }
  const parsed = runnerExportSchema.safeParse(loaded.value);
  if (!parsed.success) {
    return runnerInvalid({ mechanism: request.mechanism, detail: z.prettifyError(parsed.error) });
  }
  return { outcome: "ok", value: parsed.data.runner };
};
