import { type CommandOutcome, type NamedCheckRun, namedCheckCommandOutcome } from "../core/check/command-outcome.ts";
import type { LoadFailure } from "../core/check/load-failure.ts";
import { runProjectCommand } from "../core/check/run-project-command.ts";
import { runPruneDebtCommand } from "../core/check/run-prune-debt-command.ts";
import { recordDebtCommandOf } from "../core/check/run-record-debt-command.ts";
import { runSplitRecordsCommand } from "../core/check/run-split-records-command.ts";
import { createDefaultGitTreePort } from "../core/platform-ports/git-port.ts";
import { type CommandHandler, toolCommandOf } from "../core/check/run-tool-command.ts";
import { type CommandRequest, printOutcome } from "../core/check/run-check-command.ts";
import { installedNamedCheckRunFor } from "../core/check/run-named-check-command.ts";
import type { Result } from "../core/values/result.ts";
import type { CheckReport } from "../core/verdict/check-report.ts";

type GatedSection = "uncovered" | "stale" | "forfeited" | "doublyHeld" | "invalidRecords" | "unmeasured" | "projectionProblems";

const GATED_SECTIONS: readonly GatedSection[] = [
  "uncovered",
  "stale",
  "forfeited",
  "doublyHeld",
  "invalidRecords",
  "unmeasured",
  "projectionProblems",
];

const failingGatesOf = (request: { readonly report: CheckReport }): readonly string[] =>
  GATED_SECTIONS.filter((section) => request.report[section].length > 0).map(
    (section) => `${section} (${request.report[section].length})`,
  );

const gateLineOf = (request: { readonly report: CheckReport; readonly failing: readonly string[] }): string =>
  request.failing.length > 0
    ? `self-check: fail, gated sections hold entries: ${request.failing.join(", ")}\n`
    : `self-check: pass, the selection, records and projection are sound; findings (${request.report.findings.length}) and unrecorded (${request.report.unrecorded.length}) are reported above and not gated\n`;

export const selfCheckOutcomeOf = (request: { readonly result: Result<NamedCheckRun, LoadFailure> }): CommandOutcome => {
  const checked = namedCheckCommandOutcome(request);
  if (request.result.outcome === "failed") {
    return checked;
  }
  const failing = failingGatesOf({ report: request.result.value.report });
  return {
    code: failing.length > 0 ? 1 : 0,
    text: `${checked.text}${gateLineOf({ report: request.result.value.report, failing })}`,
  };
};

const runGatedCheckCommand: CommandHandler = (request: CommandRequest) =>
  installedNamedCheckRunFor(request).then((ranCheck) =>
    printOutcome({ process: request.process, outcome: selfCheckOutcomeOf({ result: ranCheck }) }),
  );

export const runSelfCheck: CommandHandler = toolCommandOf({
  subcommands: {
    check: runGatedCheckCommand,
    project: runProjectCommand,
    "record-debt": recordDebtCommandOf({ gitTree: createDefaultGitTreePort({}) }),
    "prune-debt": runPruneDebtCommand,
    "split-records": runSplitRecordsCommand,
  },
});