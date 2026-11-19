import { createSelectionRepository, readRunSettings } from "../consumer-selection/consumer-selection.ts";
import type { DebtPair } from "../exception-records/debt-pair.ts";
import type { ExceptionRepository } from "../exception-records/exception-records.ts";
import { paidDebtOf } from "../exception-records/paid-debt.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { assessmentInEffect } from "../values/assessment.ts";
import { moduleExtensionOf } from "../values/install-layout.ts";
import type { Result } from "../values/result.ts";
import { parsePruneDebtArguments, type PruneDebtArguments } from "./command-arguments.ts";
import { pruneDebtCommandOutcome } from "./command-outcome.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "./load-failure.ts";
import { type CommandRequest, printOutcome, repoRootOf, withShownPaths } from "./run-check-command.ts";
import { runCheck } from "./run-check.ts";

type PruneRequest = CommandRequest & {
  readonly arguments: PruneDebtArguments;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly exceptionRepository: ExceptionRepository;
};

type PruneResult = Result<readonly DebtPair[], LoadFailure>;

const paidDebtRemoved = async (request: PruneRequest): Promise<PruneResult> => {
  const configured = readRunSettings({ fileText: request.fileText, path: request.path, repoRoot: request.repoRoot });
  if (configured.outcome === "failed") {
    return configured;
  }
  const moduleExtension = moduleExtensionOf({ moduleUrl: request.moduleUrl });
  const report = await runCheck({
    ...request,
    moduleExtension,
    baseRevision: request.arguments.baseRevision,
    assessment: assessmentInEffect({ requested: { forfeiture: request.arguments.forfeiture }, configured: configured.value.assessment }),
    selectionRepository: createSelectionRepository({ ...request, moduleExtension }),
  });
  return report.outcome === "failed" ? report : request.exceptionRepository.remove({ pairs: paidDebtOf(report.value) });
};

const pruneDebtResult = async (request: CommandRequest): Promise<PruneResult> => {
  const parsed = parsePruneDebtArguments({ arguments: request.process.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const repoRoot = repoRootOf({ path: request.path, fileText: request.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  const run: PruneResult =
    installRoot.outcome === "failed"
      ? installRoot
      : await paidDebtRemoved({
          ...request,
          arguments: parsed.value,
          repoRoot: repoRoot.value,
          installRoot: installRoot.value,
          exceptionRepository: request.exceptionRepositoryOf({ repoRoot: repoRoot.value }),
        });
  return withShownPaths({ path: request.path, fileText: request.fileText, repoRoot: repoRoot.value, installRoot, run });
};

export const runPruneDebtCommand = (request: CommandRequest): Promise<void> =>
  pruneDebtResult(request).then((pruned) => printOutcome({ process: request.process, outcome: pruneDebtCommandOutcome({ result: pruned }) }));
