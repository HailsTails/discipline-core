import type { DebtPair } from "../exception-records/debt-pair.ts";
import type { RecordsSplit } from "../exception-records/exception-records.ts";
import { type InheritedDebtOutcome, RECORD_DEBT_SUBCOMMAND } from "../exception-records/inherited-debt.ts";
import type { ProjectionWrite } from "../mechanism-port/runner-result-schema.ts";
import { clauseAddressText } from "../values/clause-address.ts";
import type { ExitCode } from "../platform-ports/process-port.ts";
import type { ReportOutput } from "../values/report-output.ts";
import type { Result } from "../values/result.ts";
import type { CheckReport } from "../verdict/check-report.ts";
import { NESTED_CONFIGURATION_ISSUE, renderReportText } from "../verdict/report-text.ts";
import { verdictOf } from "../verdict/verdict.ts";
import { LEAVE_OPTION } from "./command-line.ts";
import type { LoadFailure } from "./load-failure.ts";
import { loadFailureText } from "./load-failure-text.ts";

export type CommandOutcome = {
  readonly code: ExitCode;
  readonly text: string;
};

export type CheckRun = {
  readonly report: CheckReport;
  readonly output: ReportOutput;
  readonly projectCommand: string;
  readonly pruneCommand: string;
};

const LOAD_FAILURE_CODE = 2;

export const loadFailureOutcome =(request: { readonly failure: LoadFailure }): CommandOutcome => ({
  code: LOAD_FAILURE_CODE,
  text: loadFailureText(request),
});

const checkRunOutcome = (request: { readonly run: CheckRun }): CommandOutcome => ({
  code: verdictOf({ report: request.run.report }) === "pass" ? 0 : 1,
  text: renderReportText(request.run),
});

export const checkCommandOutcome = (request: {
  readonly result: Result<CheckRun, LoadFailure>;
}): CommandOutcome =>
  request.result.outcome === "failed"
    ? loadFailureOutcome({ failure: request.result.error })
    : checkRunOutcome({ run: request.result.value });

export const projectCommandOutcome = (request: {
  readonly result: Result<readonly ProjectionWrite[], LoadFailure>;
}): CommandOutcome => {
  if (request.result.outcome === "failed") {
    return loadFailureOutcome({ failure: request.result.error });
  }
  return {
    code: 0,
    text: request.result.value.map((write) => `${write.path} ${write.effect}\n`).join(""),
  };
};

export const versionCommandOutcome = (request: { readonly result: Result<string, LoadFailure> }): CommandOutcome =>
  request.result.outcome === "failed"
    ? loadFailureOutcome({ failure: request.result.error })
    : { code: 0, text: `${request.result.value}\n` };

const inheritedDebtNote = (request: { readonly outcome: InheritedDebtOutcome }): string => {
  const { outcome } = request;
  switch (outcome.effect) {
    case "recorded":
      return "";
    case "already-recorded":
      return `: ${outcome.heldIn} already holds a record on this clause and file; the check says why it does not hold`;
    case "left":
      return `: under ${LEAVE_OPTION.name} ${outcome.under}; record it as an authorised-location with its own reason, or fix it`;
    case "new-file":
      return ": the base revision does not hold this file, so its debt was not inherited; fix it, or record it with its own reason";
    case "refused":
      return ": the clause's discipline refuses exceptions; fix it";
    case "nested-configuration":
      return `: the file loads the ${outcome.mechanism} configuration in ${outcome.under}, and ${outcome.selectionFolder} holds its own disciplines.json; nested Hone configurations are not supported yet (${NESTED_CONFIGURATION_ISSUE}), so the ${outcome.mechanism} projection cannot put a record on this file into effect; fix it, or govern ${outcome.selectionFolder} from this repository by removing ${outcome.selectionFolder}/disciplines.json, then run ${RECORD_DEBT_SUBCOMMAND} again`;
  }
};

export const inheritedDebtLine = (request: { readonly outcome: InheritedDebtOutcome }): string =>
  `${clauseAddressText({ address: request.outcome.clause })} ${request.outcome.effect} ${request.outcome.file}${inheritedDebtNote(request)}
`;

export const recordDebtCommandOutcome = (request: {
  readonly result: Result<readonly InheritedDebtOutcome[], LoadFailure>;
}): CommandOutcome =>
  request.result.outcome === "failed"
    ? loadFailureOutcome({ failure: request.result.error })
    : { code: 0, text: request.result.value.map((outcome) => inheritedDebtLine({ outcome })).join("") };

export const pruneDebtCommandOutcome = (request: {
  readonly result: Result<readonly DebtPair[], LoadFailure>;
}): CommandOutcome =>
  request.result.outcome === "failed"
    ? loadFailureOutcome({ failure: request.result.error })
    : {
        code: 0,
        text: request.result.value.map((pair) => `${clauseAddressText({ address: pair.clause })} removed ${pair.file}\n`).join(""),
      };

const recordsSplitText =(request: { readonly split: RecordsSplit }): string => {
  const { split } = request;
  switch (split.effect) {
    case "split":
      return split.writes.map((write) => `${write.path} ${write.effect}\n`).join("");
    case "already-split":
      return `${split.path} already holds the records split: nothing to split\n`;
    case "no-records":
      return `${split.path} holds no records: nothing to split\n`;
  }
};

export const splitRecordsCommandOutcome = (request: {
  readonly result: Result<RecordsSplit, LoadFailure>;
}): CommandOutcome =>
  request.result.outcome === "failed"
    ? loadFailureOutcome({ failure: request.result.error })
    : { code: 0, text: recordsSplitText({ split: request.result.value }) };
