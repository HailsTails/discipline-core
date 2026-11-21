import { type GuidedCheckRun, guidedCheckCommandOutcome } from "../core/check/check-command-outcome.ts";
import type { CommandOutcome } from "../core/command-line/command-outcome.ts";
import type { LoadFailure } from "../core/command-line/load-failure.ts";
import { installedVersionTwoCheckedOf, TOOL_SUBCOMMANDS, toolCommandOf } from "../core/check/run-tool-command.ts";
import type { CommandHandler } from "../core/check/run-tool-command.ts";
import { printOutcome } from "../core/command-line/print-outcome.ts";
import { installedGuidedCheckRunFor } from "../core/check/run-guided-check-command.ts";
import { RUN_SECTION_NAMES, type RunSectionName, runSectionRoleOf } from "../core/report/report-sections.ts";
import { type VersionedHandler, versionChosenCommandOf } from "../core/run/version-chosen-command.ts";
import type { VersionTwoChecked } from "../core/run/version-two-check-command.ts";
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

const REPORTED_NOT_GATED: readonly RunSectionName[] = ["findings", "unrecorded"];

export const VERSION_TWO_GATED_SECTIONS: readonly RunSectionName[] = RUN_SECTION_NAMES.filter(
  (section) => runSectionRoleOf({ section }) === "failing" && !REPORTED_NOT_GATED.includes(section),
);

const failingGatesOf = (request: { readonly report: CheckReport }): readonly string[] =>
  GATED_SECTIONS.filter((section) => request.report[section].length > 0).map(
    (section) => `${section} (${request.report[section].length})`,
  );

const gateLineOf = (request: { readonly findings: number; readonly unrecorded: number; readonly failing: readonly string[] }): string =>
  request.failing.length > 0
    ? `self-check: fail, gated sections hold entries: ${request.failing.join(", ")}\n`
    : `self-check: pass, the selection, records and projection are sound; findings (${request.findings}) and unrecorded (${request.unrecorded}) are reported above and not gated\n`;

export const selfCheckOutcomeOf = (request: { readonly result: Result<GuidedCheckRun, LoadFailure> }): CommandOutcome => {
  const checked = guidedCheckCommandOutcome(request);
  if (request.result.outcome === "failed") {
    return checked;
  }
  const { report } = request.result.value;
  const failing = failingGatesOf({ report });
  return {
    code: failing.length > 0 ? 1 : 0,
    text: `${checked.text}${gateLineOf({ findings: report.findings.length, unrecorded: report.unrecorded.length, failing })}`,
  };
};

export const versionTwoSelfCheckOutcomeOf = (request: { readonly checked: VersionTwoChecked }): CommandOutcome => {
  const { checked } = request;
  if (checked.kind === "not-run") {
    return checked.outcome;
  }
  const { report } = checked;
  const failing = VERSION_TWO_GATED_SECTIONS.filter((section) => report[section].length > 0).map((section) => `${section} (${report[section].length})`);
  return {
    code: failing.length > 0 ? 1 : 0,
    text: `${checked.outcome.text}${gateLineOf({ findings: report.findings.length, unrecorded: report.unrecorded.length, failing })}`,
  };
};

const runGatedCheckCommand: CommandHandler = (command) =>
  installedGuidedCheckRunFor({ command }).then((ranCheck) =>
    printOutcome({ process: command.process, outcome: selfCheckOutcomeOf({ result: ranCheck }) }),
  );

const runGatedVersionTwoCheckCommand: VersionedHandler = (command) =>
  installedVersionTwoCheckedOf(command).then((checked) =>
    printOutcome({ process: command.process, outcome: versionTwoSelfCheckOutcomeOf({ checked }) }),
  );

export const runSelfCheck: CommandHandler = toolCommandOf({
  subcommands: {
    ...TOOL_SUBCOMMANDS,
    check: versionChosenCommandOf({ versionOne: runGatedCheckCommand, versionTwo: runGatedVersionTwoCheckCommand }),
  },
});
