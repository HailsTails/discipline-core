import type { ProjectionWrite } from "../mechanism-port/runner-result-schema.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import { parseProjectArguments } from "../command-line/command-arguments.ts";
import { projectCommandOutcome } from "../command-line/command-outcome.ts";
import { moduleExtensionOf } from "../values/install-layout.ts";
import { installRootOf } from "../command-line/install-root.ts";
import type { LoadFailure } from "../command-line/load-failure.ts";
import { repoRootOf } from "./check-locations.ts";
import { type CommandRequest, printOutcome, withShownPaths } from "./run-check-command.ts";
import { runProject } from "./run-project.ts";

const projectionsIn = (
  request: CommandRequest & { readonly repoRoot: AbsolutePath; readonly installRoot: Result<AbsolutePath, LoadFailure> },
): Promise<Result<readonly ProjectionWrite[], LoadFailure>> => {
  if (request.installRoot.outcome === "failed") {
    return Promise.resolve(request.installRoot);
  }
  return runProject({
    repoRoot: request.repoRoot,
    installRoot: request.installRoot.value,
    moduleExtension: moduleExtensionOf({ moduleUrl: request.moduleUrl }),
    fileText: request.fileText,
    modules: request.modules,
    path: request.path,
    git: request.git,
    exceptionRepository: request.exceptionRepositoryOf({ repoRoot: request.repoRoot }),
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
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  return projectionsIn({ ...request, repoRoot: repoRoot.value, installRoot }).then((run) =>
    withShownPaths({ path: request.path, fileText: request.fileText, repoRoot: repoRoot.value, installRoot, run }),
  );
};

export const runProjectCommand = (request: CommandRequest): Promise<void> =>
  projectResult(request).then((projected) =>
    printOutcome({ process: request.process, outcome: projectCommandOutcome({ result: projected }) }),
  );
