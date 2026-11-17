import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { ReportOutput } from "../core/values/report-output.ts";
import type { CheckReport } from "../core/verdict/check-report.ts";
import { renderReportText } from "../core/verdict/report-text.ts";
import { SECTION_NAMES, type SectionName } from "../core/verdict/section-roles.ts";

export type Fills = Readonly<Record<string, string>>;

export type DocumentedLine = {
  readonly label: string;
  readonly template: string;
};

export type PrintedLine = {
  readonly label: string;
  readonly text: string;
  readonly fills: Fills;
};

export type ContractGaps = {
  readonly undocumented: readonly PrintedLine[];
  readonly unprinted: readonly DocumentedLine[];
};

export type DocumentedRole = {
  readonly section: string;
  readonly role: string;
};

export type EntryFills = (request: { readonly section: SectionName; readonly position: number }) => Fills;

const TEMPLATE_ROW = /^\| `([^`]+)` \| `([^`]+)` \|$/;

const ROLE_ROW = /^\| `([^`]+)` \| (failing|informational|guidance) \|/;

const PLACEHOLDER = /<([^<>]+)>/g;

const HEADING_LABEL = "heading";

const VERDICT_LABEL = "verdict";

const docLines = (request: { readonly text: string }): readonly string[] =>
  request.text.split("\n").map((line) => line.trimEnd());

export const documentedLinesIn = (request: { readonly text: string }): readonly DocumentedLine[] =>
  docLines(request).flatMap((line) => {
    const row = TEMPLATE_ROW.exec(line);
    return row === null ? [] : [{ label: row[1], template: row[2] }];
  });

export const documentedRolesIn = (request: { readonly text: string }): readonly DocumentedRole[] =>
  docLines(request).flatMap((line) => {
    const row = ROLE_ROW.exec(line);
    return row === null ? [] : [{ section: row[1], role: row[2] }];
  });

export const filledTemplate = (request: { readonly template: string; readonly fills: Fills }): string =>
  request.template.replace(PLACEHOLDER, (placeholder: string, name: string) => request.fills[name] ?? placeholder);

type Fit = "fits" | "misfits";

const fitOf = (request: { readonly printed: PrintedLine; readonly documented: DocumentedLine }): Fit =>
  request.printed.label === request.documented.label &&
  filledTemplate({ template: request.documented.template, fills: request.printed.fills }) === request.printed.text
    ? "fits"
    : "misfits";

export const contractGaps = (request: {
  readonly documented: readonly DocumentedLine[];
  readonly printed: readonly PrintedLine[];
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
  readonly position: number;
  readonly lines: readonly PrintedLine[];
};

const headedSection = (request: { readonly report: CheckReport; readonly line: string }): SectionName | undefined =>
  SECTION_NAMES.find((name) => {
    const heading = `${name} (${request.report[name].length})`;
    return request.line === heading || request.line.startsWith(`${heading} `);
  });

const attributed =
  (request: { readonly report: CheckReport; readonly entryFills: EntryFills }) =>
  (sofar: Attribution, line: string): Attribution => {
    const heading = headedSection({ report: request.report, line });
    if (heading !== undefined) {
      const fills = { section: heading, count: String(request.report[heading].length) };
      return { section: heading, position: 0, lines: [...sofar.lines, { label: HEADING_LABEL, text: line, fills }] };
    }
    const section = sofar.section ?? SECTION_NAMES[0];
    const fills = request.entryFills({ section, position: sofar.position });
    return { ...sofar, position: sofar.position + 1, lines: [...sofar.lines, { label: section, text: line, fills }] };
  };

export const reportLinesOf = (request: {
  readonly report: CheckReport;
  readonly output: ReportOutput;
  readonly projectCommand: string;
  readonly entryFills: EntryFills;
}): readonly PrintedLine[] => {
  const lines = renderReportText(request).split("\n").slice(0, -1);
  const entries = lines.slice(0, -1).reduce<Attribution>(attributed(request), { section: undefined, position: 0, lines: [] });
  return [...entries.lines, { label: VERDICT_LABEL, text: lines.at(-1) ?? "", fills: {} }];
};

export const contractTextAt = (request: { readonly path: string }): string => {
  const text = createDefaultFileTextPort({}).read(request);
  return text.outcome === "ok" ? text.value : "";
};
