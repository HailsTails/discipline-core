import type { RecordsSplit } from "../upgrade/version-one-records/exception-records.ts";
import type { Result } from "../values/result.ts";
import { parseSplitRecordsArguments } from "../command-line/command-arguments.ts";
import { splitRecordsCommandOutcome } from "../upgrade/version-one-records/record-command-outcomes.ts";
import { installRootOf } from "../command-line/install-root.ts";
import type { LoadFailure } from "../command-line/load-failure.ts";
import { repoRootOf } from "./check-locations.ts";
import { printOutcome } from "../command-line/print-outcome.ts";
import type { VersionOneCommandRequest } from "../upgrade/version-one-records/version-one-command-request.ts";
import { withShownPaths } from "./run-check-command.ts";

const recordsSplit = (request: VersionOneCommandRequest): Result<RecordsSplit, LoadFailure> => {
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
    run: request.exceptionRepositoryOf({ repoRoot: repoRoot.value }).moveToSplitLayout(),
  });
};

export const runSplitRecordsCommand = (request: VersionOneCommandRequest): Promise<void> => {
  printOutcome({ process: request.process, outcome: splitRecordsCommandOutcome({ result: recordsSplit(request) }) });
  return Promise.resolve();
};
