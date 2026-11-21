import { createSymptomCatalogueRepository } from "../symptom-catalogue/read-symptom-catalogue.ts";
import type { Result } from "../values/result.ts";
import { checkLocationsFor } from "./check-locations.ts";
import { type GuidedCheckRun, guidedCheckCommandOutcome } from "./check-command-outcome.ts";
import type { LoadFailure } from "../command-line/load-failure.ts";
import { printOutcome } from "../command-line/print-outcome.ts";
import type { VersionOneCommandRequest } from "../upgrade/version-one-records/version-one-command-request.ts";
import { type CheckRunAt, checkRunAt } from "./run-check-command.ts";
import { type SymptomGuideIn, symptomGuideIn } from "./symptom-guide.ts";

export type GuidedCheckRequest = {
  readonly command: VersionOneCommandRequest;
  readonly checkRunAt: CheckRunAt;
  readonly symptomGuideIn: SymptomGuideIn;
};

export const guidedCheckRunFor = async (request: GuidedCheckRequest): Promise<Result<GuidedCheckRun, LoadFailure>> => {
  const { path, fileText, modules, git, exceptionRepositoryOf, moduleUrl, process } = request.command;
  const locations = checkLocationsFor({ arguments: process.arguments, path, fileText, moduleUrl });
  if (locations.outcome === "failed") {
    return locations;
  }
  const run = await request.checkRunAt({ path, fileText, modules, git, exceptionRepositoryOf, moduleUrl, locations: locations.value });
  if (run.outcome === "failed") {
    return run;
  }
  const guide = request.symptomGuideIn({ path, fileText, repoRoot: locations.value.repoRoot, installRoot: locations.value.installRoot });
  return { outcome: "ok", value: { ...run.value, guide } };
};

export const installedGuidedCheckRunFor = (request: { readonly command: VersionOneCommandRequest }): Promise<Result<GuidedCheckRun, LoadFailure>> =>
  guidedCheckRunFor({
    command: request.command,
    checkRunAt,
    symptomGuideIn: (locations) => symptomGuideIn({ ...locations, symptomCatalogueOf: createSymptomCatalogueRepository }),
  });

export const runGuidedCheckCommand = (command: VersionOneCommandRequest): Promise<void> =>
  installedGuidedCheckRunFor({ command }).then((checked) =>
    printOutcome({ process: command.process, outcome: guidedCheckCommandOutcome({ result: checked }) }),
  );
