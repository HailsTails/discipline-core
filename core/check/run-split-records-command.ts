import type { RecordsSplit } from "../exception-records/exception-records.ts";
import type { Result } from "../values/result.ts";
import { parseSplitRecordsArguments } from "./command-arguments.ts";
import { splitRecordsCommandOutcome } from "./command-outcome.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "./load-failure.ts";
import { type CommandRequest, printOutcome, repoRootOf, withShownPaths } from "./run-check-command.ts";

const recordsSplit = (request: CommandRequest): Result<RecordsSplit, LoadFailure> => {
  const parsed = parseSplitRecordsArguments({ arguments: request.process.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const repoRoot = repoRootOf({ path: request.path, fileText: request.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  return withShownPaths({
    path: request.path,
    fileText: request.fileText,
    repoRoot: repoRoot.value,
    installRoot: installRootOf({ path: request.path, moduleUrl: request.moduleUrl }),
    run: request.exceptionRepositoryOf({ repoRoot: repoRoot.value }).split(),
  });
};

export const runSplitRecordsCommand = (request: CommandRequest): Promise<void> => {
  printOutcome({ process: request.process, outcome: splitRecordsCommandOutcome({ result: recordsSplit(request) }) });
  return Promise.resolve();
};
