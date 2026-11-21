import type { VersionTwoLoadFailure } from "../core/command-line/load-failure.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createSymptomCatalogueRepository } from "../core/symptom-catalogue/read-symptom-catalogue.ts";
import type { CatalogueHolding, SymptomCatalogue } from "../core/symptom-catalogue/symptom-catalogue.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { clauseAddressText } from "../core/values/clause-address.ts";
import type { Result } from "../core/values/result.ts";
import { repositoryRootOf } from "./allowed-forms-proof.ts";
import { contractTextAt } from "./output-contract.ts";

export type GuideCheckRow = { readonly check: string; readonly engines: readonly string[]; readonly clause: string };

export type FencedBlock = { readonly language: string; readonly body: string };

const CHECK_TABLE_INTRO = "Every check Hone ships";

const CHECK_ROW = /^\| `([^`]+)` \| (`[a-z-]+`(?: or `[a-z-]+`)*) \| `([^`]+)` \|$/;

const ENGINE_NAME = /`([a-z-]+)`/g;

const FENCED_BLOCK = /^```(\w*)\n([\s\S]*?)\n```$/gm;

const WORKED_EXAMPLE_HEADING = "\n## Worked example\n";

const NEXT_HEADING = "\n## ";

const INSTALLED_RULES = "node_modules/@hailstails/hone/rules/";

const SOURCE_RULES = "../../../../rules/";

const REPOSITORY_ROOT = repositoryRootOf({ testFolder: import.meta.dirname });

export const ADOPTING_GUIDE_TEXT = contractTextAt({ path: `${REPOSITORY_ROOT}/ADOPTING.md` });

export const guideCheckRowsOf = (request: { readonly text: string }): readonly GuideCheckRow[] =>
  request.text
    .slice(request.text.indexOf(CHECK_TABLE_INTRO))
    .split("\n")
    .flatMap((line) => {
      const row = CHECK_ROW.exec(line.trimEnd());
      return row === null ? [] : [{ check: row[1], engines: [...row[2].matchAll(ENGINE_NAME)].map((engine) => engine[1]), clause: row[3] }];
    });

export const catalogueCheckRowsOf = (request: { readonly catalogue: SymptomCatalogue }): readonly GuideCheckRow[] =>
  request.catalogue.checks.map((check) => ({ check: `${check.symptom.name}#${check.name}`, engines: check.engines.map((engine) => engine.name), clause: clauseAddressText({ address: check.clause }) }));

export const shippedCatalogueHolding = (): Result<CatalogueHolding, VersionTwoLoadFailure> =>
  createSymptomCatalogueRepository({
    fileText: createDefaultFileTextPort({}),
    path: createDefaultPathPort({}),
    ruleSetRoot: absolutePathSchema.parse(REPOSITORY_ROOT),
  }).read({});

export type WorkedExample = {
  readonly settings: FencedBlock;
  readonly beforeReport: FencedBlock;
  readonly records: FencedBlock;
  readonly afterReport: FencedBlock;
};

const MISSING_BLOCK: FencedBlock = { language: "missing", body: "" };

const workedExampleBlocksOf = (request: { readonly text: string }): readonly FencedBlock[] => {
  const from = request.text.slice(request.text.indexOf(WORKED_EXAMPLE_HEADING) + 1);
  const next = from.indexOf(NEXT_HEADING);
  const section = next === -1 ? from : from.slice(0, next);
  return [...section.matchAll(FENCED_BLOCK)].map((block) => ({ language: block[1], body: block[2] }));
};

export const workedExampleOf = (request: { readonly text: string }): WorkedExample => {
  const [settings, beforeReport, records, afterReport] = workedExampleBlocksOf(request);
  return { settings: settings ?? MISSING_BLOCK, beforeReport: beforeReport ?? MISSING_BLOCK, records: records ?? MISSING_BLOCK, afterReport: afterReport ?? MISSING_BLOCK };
};

export const reportAsInstalled = (request: { readonly text: string }): string => request.text.replaceAll(SOURCE_RULES, INSTALLED_RULES);

const byCheck = (left: GuideCheckRow, right: GuideCheckRow): number => left.check.localeCompare(right.check);

export const shippedCheckRows = (): readonly GuideCheckRow[] => {
  const holding = shippedCatalogueHolding();
  return holding.outcome === "ok" && holding.value.held === "catalogue" ? catalogueCheckRowsOf({ catalogue: holding.value.catalogue }).toSorted(byCheck) : [];
};

export const documentedCheckRows = (request: { readonly text: string }): readonly GuideCheckRow[] => guideCheckRowsOf(request).toSorted(byCheck);
