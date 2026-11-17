import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { ReportOutput } from "../core/values/report-output.ts";
import type { CheckReport } from "../core/verdict/check-report.ts";
import { renderReportText } from "../core/verdict/report-text.ts";
import { SECTION_NAMES, type SectionName } from "../core/verdict/section-roles.ts";

export type ContractLine = {
  readonly label: string;
  readonly text: string;
};

export type ContractGaps = {
  readonly undocumented: readonly ContractLine[];
  readonly unprinted: readonly ContractLine[];
};

export type DocumentedRole = {
  readonly section: string;
  readonly role: string;
};

const TEMPLATE_ROW = /^\| `([^`]+)` \| `([^`]+)` \|$/;

const ROLE_ROW = /^\| `([^`]+)` \| (failing|informational|guidance) \|/;

const PLACEHOLDER = /<[^<>]+>/g;

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

const ANY_VALUE = "(?:.+?)";

const HEADING_LABEL = "heading";

const VERDICT_LABEL = "verdict";

const docLines = (request: { readonly text: string }): readonly string[] =>
  request.text.split("\n").map((line) => line.trimEnd());

export const documentedLinesIn = (request: { readonly text: string }): readonly ContractLine[] =>
  docLines(request).flatMap((line) => {
    const row = TEMPLATE_ROW.exec(line);
    return row === null ? [] : [{ label: row[1], text: row[2] }];
  });

export const documentedRolesIn = (request: { readonly text: string }): readonly DocumentedRole[] =>
  docLines(request).flatMap((line) => {
    const row = ROLE_ROW.exec(line);
    return row === null ? [] : [{ section: row[1], role: row[2] }];
  });

const templatePattern = (request: { readonly template: string }): RegExp =>
  new RegExp(
    `^${request.template
      .split(PLACEHOLDER)
      .map((literal) => literal.replace(REGEX_SPECIAL, "\\$&"))
      .join(ANY_VALUE)}$`,
    "u",
  );

type Fit = "fits" | "misfits";

const fitOf = (request: { readonly printed: ContractLine; readonly documented: ContractLine }): Fit =>
  request.printed.label === request.documented.label && templatePattern({ template: request.documented.text }).test(request.printed.text)
    ? "fits"
    : "misfits";

export const contractGaps = (request: {
  readonly documented: readonly ContractLine[];
  readonly printed: readonly ContractLine[];
}): ContractGaps => ({
  undocumented: request.printed.filter((printed) =>
    request.documented.every((documented) => fitOf({ printed, documented }) === "misfits"),
  ),
  unprinted: request.documented.filter((documented) =>
    request.printed.every((printed) => fitOf({ printed, documented }) === "misfits"),
  ),
});

type Attribution = {
  readonly section: SectionName | undefined;
  readonly lines: readonly ContractLine[];
};

const headedSection = (request: { readonly report: CheckReport; readonly line: string }): SectionName | undefined =>
  SECTION_NAMES.find((name) => {
    const heading = `${name} (${request.report[name].length})`;
    return request.line === heading || request.line.startsWith(`${heading} `);
  });

const attributed = (request: { readonly report: CheckReport }) => (sofar: Attribution, line: string): Attribution => {
  const heading = headedSection({ report: request.report, line });
  if (heading !== undefined) {
    return { section: heading, lines: [...sofar.lines, { label: HEADING_LABEL, text: line }] };
  }
  return { ...sofar, lines: [...sofar.lines, { label: sofar.section ?? HEADING_LABEL, text: line }] };
};

export const reportLinesOf = (request: { readonly report: CheckReport; readonly output: ReportOutput }): readonly ContractLine[] => {
  const lines = renderReportText(request).split("\n").slice(0, -1);
  const entries = lines.slice(0, -1).reduce<Attribution>(attributed(request), { section: undefined, lines: [] });
  return [...entries.lines, { label: VERDICT_LABEL, text: lines.at(-1) ?? "" }];
};

export const contractTextAt = (request: { readonly path: string }): string => {
  const text = createDefaultFileTextPort({}).read(request);
  return text.outcome === "ok" ? text.value : "";
};
