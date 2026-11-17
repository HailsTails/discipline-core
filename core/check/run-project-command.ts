import type { ProjectionWrite } from "../mechanism-port/runner-result-schema.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import { parseProjectArguments } from "./command-arguments.ts";
import { projectCommandOutcome } from "./command-outcome.ts";
import { moduleExtensionOf } from "../values/install-layout.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "./load-failure.ts";
import { type CommandRequest, printOutcome, repoRootOf, withShownPaths } from "./run-check-command.ts";
import { runProject } from "./run-project.ts";

const projectionsIn = (
  request: CommandRequest & { readonly repoRoot: AbsolutePath },
): Promise<Result<readonly ProjectionWrite[], LoadFailure>> => {
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  if (installRoot.outcome === "failed") {
    return Promise.resolve(installRoot);
  }
  return runProject({
    repoRoot: request.repoRoot,
    installRoot: installRoot.value,
    moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }),
    fileText: request.fileText,
    modules: request.modules,
    path: request.path,
    git: request.git,
  });
};

const projectResult = (request: CommandRequest): Promise<Result<readonly ProjectionWrite[], LoadFailure>> => {
  const parsed = parseProjectArguments({ arguments: request.process.arguments });
  if (parsed.outcome === "failed") {
    return Promise.resolve(parsed);
  }
  const repoRoot = repoRootOf({ path: request.path, fileText: request.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return Promise.resolve(repoRoot);
  }
  return projectionsIn({ ...request, repoRoot: repoRoot.value }).then((run) =>
    withShownPaths({ path: request.path, repoRoot: repoRoot.value, run }),
  );
};

export const runProjectCommand = (request: CommandRequest): Promise<void> =>
  projectResult(request).then((projected) =>
    printOutcome({ process: request.process, outcome: projectCommandOutcome({ result: projected }) }),
  );
