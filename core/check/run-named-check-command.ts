import { createSymptomCatalogueRepository } from "../symptom-catalogue/read-symptom-catalogue.ts";
import type { Result } from "../values/result.ts";
import type { SymptomGuide } from "../verdict/symptom-notes.ts";
import { type CheckRun, type NamedCheckRun, namedCheckCommandOutcome } from "./command-outcome.ts";
import type { LoadFailure } from "./load-failure.ts";
import { type CommandRequest, checkRunFor, printOutcome } from "./run-check-command.ts";
import { symptomGuideFor } from "./symptom-guide.ts";

export type NamedCheckRequest = CommandRequest & {
  readonly checkRunFor: (request: CommandRequest) => Promise<Result<CheckRun, LoadFailure>>;
  readonly symptomGuideFor: (request: CommandRequest) => Result<SymptomGuide, LoadFailure>;
};

export const namedCheckRunFor = async (request: NamedCheckRequest): Promise<Result<NamedCheckRun, LoadFailure>> => {
  const run = await request.checkRunFor(request);
  if (run.outcome === "failed") {
    return run;
  }
  const guide = request.symptomGuideFor(request);
  return guide.outcome === "failed" ? guide : { outcome: "ok", value: { ...run.value, guide: guide.value } };
};

export const installedNamedCheckRunFor = (request: CommandRequest): Promise<Result<NamedCheckRun, LoadFailure>> =>
  namedCheckRunFor({
    ...request,
    checkRunFor,
    symptomGuideFor: (command) => symptomGuideFor({ ...command, symptomCatalogueOf: createSymptomCatalogueRepository }),
  });

export const runNamedCheckCommand = (request: CommandRequest): Promise<void> =>
  installedNamedCheckRunFor(request).then((checked) =>
    printOutcome({ process: request.process, outcome: namedCheckCommandOutcome({ result: checked }) }),
  );
