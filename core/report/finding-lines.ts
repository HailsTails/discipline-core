import type { AttributedNativeException, Finding } from "../governance/governance.ts";
import type { InlineReach, ScriptOptionCause } from "../mechanism-port/runner-result-schema.ts";
import type { AnsweredFinding } from "../records/answering.ts";
import { checkAddressOf } from "../symptom-catalogue/check-address.ts";
import { type Check, indicatedNamesOf, type SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import { type CheckSite, checkSiteText, findingSiteOf, nativeSitesOf } from "./check-site.ts";
import { onOneLine, quoted } from "./printed-text.ts";
import { referencesText } from "./record-lines.ts";
import type { CheckEdition } from "./run-report.ts";

type CatalogueRequest = { readonly catalogue: SymptomCatalogue };

const locatedText = (request: { readonly site: CheckSite; readonly finding: Finding }): string =>
  `${checkSiteText(request)} ${request.finding.file}:${request.finding.anchor.line}:${request.finding.anchor.column} ${onOneLine({ text: request.finding.snippet })}`;

const indicationNote = (request: { readonly site: CheckSite }): string =>
  request.site.sited === "check" ? ` may indicate: ${indicatedNamesOf({ symptom: request.site.check.symptom }).join(", ")}` : "";

const fixNote = (request: { readonly finding: Finding }): string =>
  request.finding.remedy === undefined ? "" : ` fix: ${onOneLine({ text: request.finding.remedy.fix })} (${request.finding.remedy.page}#${request.finding.remedy.section})`;

export const findingLine = (request: CatalogueRequest & { readonly finding: Finding }): string => {
  const site = findingSiteOf(request);
  return `${locatedText({ site, finding: request.finding })}${indicationNote({ site })}${fixNote(request)}`;
};

export const answeredLine = (request: CatalogueRequest & { readonly answered: AnsweredFinding }): string => {
  const { finding, by } = request.answered;
  return `${locatedText({ site: findingSiteOf({ catalogue: request.catalogue, finding }), finding })}${referencesText({ lead: "answered by", records: by })}`;
};

export const editionLine = (request: { readonly reading: CheckEdition }): string =>
  `${checkAddressOf(request.reading)} ${request.reading.engine.name} edition ${request.reading.edition} of ${request.reading.latest}`;

export const checkLine = (request: { readonly check: Check }): string => checkAddressOf(request);

export const notRunLine = (request: { readonly check: Check }): string => `${checkAddressOf(request)} adopted, engine not run: enforced by review`;

const INLINE_REACH_NOTE: Readonly<Record<InlineReach, string>> = {
  "one-clause": "",
  "every-selected-clause": " names no rule and escapes every selected check: naming the rule is the cheap fix",
};

const UNJUDGED_OPTION = "so Hone cannot tell what the option does to the files under check";

const scriptOptionNote = (request: { readonly cause: ScriptOptionCause }): string => {
  switch (request.cause.kind) {
    case "weakens-run":
      return " weakens the script's whole run, so no record can cover it: remove it from the script";
    case "after-another-command":
      return `: ${request.cause.command} is not the first command of its script, ${UNJUDGED_OPTION}; give ${request.cause.command} a script of its own, such as ${quoted({ text: request.cause.invocation })}`;
    case "wrapped":
      return `: ${quoted({ text: request.cause.wrapper })} comes before ${request.cause.command} and is neither a package runner nor a NAME=value setting, ${UNJUDGED_OPTION}; put only package runners and NAME=value settings before ${request.cause.command}`;
    case "unreadable":
      return `: a quote in the script has no partner, so Hone cannot read what the script passes to ${request.cause.command} or tell what that does to the files under check; pair every quote in the script`;
  }
};

const inlineDetail = (request: { readonly exception: { readonly file: string; readonly line: number; readonly text: string } }): string =>
  `${request.exception.file}:${request.exception.line} ${onOneLine({ text: request.exception.text })}`;

const unrecordedDetail = (request: { readonly exception: AttributedNativeException }): string => {
  const { exception } = request;
  switch (exception.kind) {
    case "ignore":
    case "config-override":
      return exception.file;
    case "suppression-entry":
      return `${exception.file} ${exception.location}`;
    case "inline-disable":
      return `${inlineDetail({ exception })}${INLINE_REACH_NOTE[exception.reach]}`;
    case "inline-rule-config":
      return inlineDetail({ exception });
    case "command-line-option":
      return `${exception.location} ${onOneLine({ text: exception.script })} ${onOneLine({ text: exception.option })}${scriptOptionNote({ cause: exception.cause })}`;
  }
};

export const unrecordedLines = (request: CatalogueRequest & { readonly exception: AttributedNativeException }): readonly string[] =>
  nativeSitesOf(request).map((site) => `${checkSiteText({ site })} ${request.exception.kind} ${unrecordedDetail(request)}`);
