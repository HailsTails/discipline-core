import type { Finding } from "../governance/governance.ts";
import { clauseAddressText } from "../values/clause-address.ts";

export const escapedLineBreaks = (request: { readonly text: string }): string =>
  request.text.replaceAll("\n", "\\n").replaceAll("\r", "\\r");

export const locatedFindingLine = (request: { readonly finding: Finding }): string =>
  `${clauseAddressText({ address: request.finding.clause })} ${request.finding.mechanism} ${request.finding.file}:${request.finding.anchor.line}:${request.finding.anchor.column} ${escapedLineBreaks({ text: request.finding.snippet })}`;

const remedyNote = (request: { readonly finding: Finding }): string =>
  request.finding.remedy === undefined
    ? ""
    : ` fix: ${escapedLineBreaks({ text: request.finding.remedy.fix })} (${request.finding.remedy.page}#${request.finding.remedy.section})`;

export const findingLine = (request: { readonly finding: Finding }): string =>
  `${locatedFindingLine(request)}${remedyNote(request)}`;
