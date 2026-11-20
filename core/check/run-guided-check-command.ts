import { createSymptomCatalogueRepository } from "../symptom-catalogue/read-symptom-catalogue.ts";
import type { Result } from "../values/result.ts";
import { checkLocationsFor } from "./check-locations.ts";
import { type GuidedCheckRun, guidedCheckCommandOutcome } from "./command-outcome.ts";
import type { LoadFailure } from "./load-failure.ts";
import { type CheckRunIn, type CommandRequest, checkRunIn, printOutcome } from "./run-check-command.ts";
import { type SymptomGuideIn, symptomGuideIn } from "./symptom-guide.ts";

export type GuidedCheckRequest = {
  readonly command: CommandRequest;
  readonly checkRunIn: CheckRunIn;
  readonly symptomGuideIn: SymptomGuideIn;
};

export const guidedCheckRunFor = async (request: GuidedCheckRequest): Promise<Result<GuidedCheckRun, LoadFailure>> => {
  const { path, fileText, modules, git, exceptionRepositoryOf, moduleUrl, process } = request.command;
  const locations = checkLocationsFor({ arguments: process.arguments, path, fileText, moduleUrl });
  if (locations.outcome === "failed") {
    return locations;
  }
  const run = await request.checkRunIn({ path, fileText, modules, git, exceptionRepositoryOf, moduleUrl, locations: locations.value });
  if (run.outcome === "failed") {
    return run;
  }
  const guide = request.symptomGuideIn({ path, fileText, repoRoot: locations.value.repoRoot, installRoot: locations.value.installRoot });
  return { outcome: "ok", value: { ...run.value, guide } };
};

export const installedGuidedCheckRunFor = (request: { readonly command: CommandRequest }): Promise<Result<GuidedCheckRun, LoadFailure>> =>
  guidedCheckRunFor({
    command: request.command,
    checkRunIn,
    symptomGuideIn: (locations) => symptomGuideIn({ ...locations, symptomCatalogueOf: createSymptomCatalogueRepository }),
  });

export const runGuidedCheckCommand = (command: CommandRequest): Promise<void> =>
  installedGuidedCheckRunFor({ command }).then((checked) =>
    printOutcome({ process: command.process, outcome: guidedCheckCommandOutcome({ result: checked }) }),
  );
