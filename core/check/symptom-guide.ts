import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import type { CatalogueHolding } from "../symptom-catalogue/symptom-catalogue.ts";
import type { SymptomCatalogueRepository } from "../symptom-catalogue/symptom-catalogue-repository.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import { NO_SYMPTOM_GUIDE, type SymptomGuide } from "../verdict/symptom-notes.ts";
import { parseCheckArguments } from "./command-arguments.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "./load-failure.ts";
import { packageLinkOf } from "./package-link.ts";
import { repoRootOf, withShownPaths } from "./run-check-command.ts";
import { shownPathOf } from "./shown-path.ts";

const SYMPTOM_PAGE_SEGMENTS: readonly string[] = ["rules", "typescript", "symptoms.md"];

export type SymptomCatalogueOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
}) => SymptomCatalogueRepository;

type GuideRequest = {
  readonly process: Pick<ProcessPort, "arguments">;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly moduleUrl: string;
  readonly symptomCatalogueOf: SymptomCatalogueOf;
};

type InstalledGuideRequest = GuideRequest & { readonly repoRoot: AbsolutePath; readonly installRoot: AbsolutePath };

const symptomPageOf = (request: InstalledGuideRequest): string =>
  shownPathOf({
    path: request.path,
    repoRoot: request.repoRoot,
    link: packageLinkOf(request),
    target: request.path.join({ segments: [request.installRoot, ...SYMPTOM_PAGE_SEGMENTS] }),
  });

const guideOf = (request: InstalledGuideRequest & { readonly holding: CatalogueHolding }): SymptomGuide =>
  request.holding.held === "none" ? NO_SYMPTOM_GUIDE : { guide: "catalogue", catalogue: request.holding.catalogue, page: symptomPageOf(request) };

const installedGuideOf = (request: InstalledGuideRequest): Result<SymptomGuide, LoadFailure> => {
  const holding = request.symptomCatalogueOf({ fileText: request.fileText, path: request.path, ruleSetRoot: request.installRoot }).read({});
  return holding.outcome === "failed" ? holding : { outcome: "ok", value: guideOf({ ...request, holding: holding.value }) };
};

export const symptomGuideFor = (request: GuideRequest): Result<SymptomGuide, LoadFailure> => {
  const parsed = parseCheckArguments({ arguments: request.process.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const repoRoot = repoRootOf({ path: request.path, fileText: request.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const installRoot = installRootOf(request);
  return withShownPaths({
    path: request.path,
    fileText: request.fileText,
    repoRoot: repoRoot.value,
    installRoot,
    run: installRoot.outcome === "failed" ? installRoot : installedGuideOf({ ...request, repoRoot: repoRoot.value, installRoot: installRoot.value }),
  });
};
