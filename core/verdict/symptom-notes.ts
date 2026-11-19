import type { Finding } from "../governance/governance.ts";
import {
  type CorrectUse,
  type Indication,
  type Pointed,
  type RecordKind,
  type Symptom,
  type SymptomCatalogue,
  type SymptomReading,
  symptomReadingOf,
} from "../symptom-catalogue/symptom-catalogue.ts";

export type SymptomGuide =
  | { readonly guide: "none" }
  | { readonly guide: "catalogue"; readonly catalogue: SymptomCatalogue; readonly page: string };

export const NO_SYMPTOM_GUIDE: SymptomGuide = { guide: "none" };

type CatalogueGuide = Extract<SymptomGuide, { readonly guide: "catalogue" }>;

export const symptomReadingIn = (request: { readonly guide: SymptomGuide; readonly finding: Finding }): SymptomReading =>
  request.guide.guide === "none"
    ? { reading: "not-in-catalogue" }
    : symptomReadingOf({ catalogue: request.guide.catalogue, finding: request.finding });

const lowerFirst = (request: { readonly text: string }): string => `${request.text.charAt(0).toLowerCase()}${request.text.slice(1)}`;

const upperFirst = (request: { readonly text: string }): string => `${request.text.charAt(0).toUpperCase()}${request.text.slice(1)}`;

const pointedTitleOf = (point: Pointed): string => (point.kind === "rule" ? point.rule.title : point.principle.title);

const indicationText = (indication: Indication): string =>
  `${lowerFirst({ text: indication.case })} → ${indication.points.map(pointedTitleOf).join(", ")}`;

const recipeSentence = (request: { readonly symptom: Symptom }): string => {
  const titles = request.symptom.recipes.map((recipe) => recipe.title);
  if (titles.length === 0) {
    return "";
  }
  return ` ${titles.length === 1 ? "Recipe" : "Recipes"}: ${titles.join("; ")}.`;
};

const formatText = (kind: RecordKind): string => (kind.todaysFormat === "none-yet" ? "no record format yet" : `today: ${kind.todaysFormat}`);

const answerText = (request: { readonly use: CorrectUse; readonly index: number }): string => {
  const { use } = request;
  const lead = request.index === 0 ? `${upperFirst({ text: use.situation })} is answered by` : `${use.situation} by`;
  const place = use.at === undefined ? "" : ` ${use.at}`;
  return `${lead} ${use.kind.phrase}${place} (${formatText(use.kind)})`;
};

const answersText = (request: { readonly catalogue: SymptomCatalogue; readonly symptom: Symptom }): string => {
  const uses: readonly CorrectUse[] = [...request.symptom.correctUses, { situation: "known debt", kind: request.catalogue.alwaysRecordable.debt }];
  return uses.map((use, index) => answerText({ use, index })).join("; ");
};

const noteLineOf = (request: CatalogueGuide & { readonly symptom: Symptom }): string => {
  const { symptom } = request;
  const indications = symptom.mayIndicate.map(indicationText).join("; ");
  return `${symptom.name}: ${symptom.title}. May indicate: ${indications}. The breach usually sits ${symptom.breachUsuallySits}.${recipeSentence(request)} ${answersText(request)}. Read ${request.page}#${symptom.name}`;
};

const namedSymptomsOf = (request: { readonly guide: SymptomGuide; readonly findings: readonly Finding[] }): readonly Symptom[] => [
  ...new Map(
    request.findings.flatMap((finding) => {
      const reading = symptomReadingIn({ guide: request.guide, finding });
      return reading.reading === "named" ? [[reading.symptom.name, reading.symptom] as const] : [];
    }),
  ).values(),
];

export const symptomNoteLinesOf = (request: { readonly guide: SymptomGuide; readonly findings: readonly Finding[] }): readonly string[] => {
  const { guide } = request;
  return guide.guide === "none" ? [] : namedSymptomsOf(request).map((symptom) => noteLineOf({ ...guide, symptom }));
};
