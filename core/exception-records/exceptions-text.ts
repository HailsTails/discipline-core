import type { Result } from "../values/result.ts";
import type { ExceptionEntry } from "./exception-record.ts";

type ListBounds = { readonly key: number; readonly open: number; readonly close: number };

type Scan = {
  readonly depth: number;
  readonly quoting: "outside" | "inside" | "escaping";
  readonly stringStart: number;
  readonly lastTopString: { readonly text: string; readonly start: number } | undefined;
  readonly lastSignificant: string;
  readonly opened: { readonly key: number; readonly open: number } | undefined;
  readonly bounds: ListBounds | undefined;
};

const EXCEPTIONS_KEY = "exceptions";

const TOP_LEVEL = 1;

const INDENT_STEP = "  ";

const OPENERS = new Set(["{", "["]);

const CLOSERS = new Set(["}", "]"]);

const WHITESPACE = /\s/;

const LINE_START_INDENT = /^[ \t]*/;

const STARTING_SCAN: Scan = {
  depth: 0,
  quoting: "outside",
  stringStart: 0,
  lastTopString: undefined,
  lastSignificant: "",
  opened: undefined,
  bounds: undefined,
};

const quotedScan = (request: { readonly scan: Scan; readonly character: string; readonly position: number; readonly text: string }): Scan => {
  const { scan, character } = request;
  if (scan.quoting === "escaping") {
    return { ...scan, quoting: "inside" };
  }
  if (character === "\\") {
    return { ...scan, quoting: "escaping" };
  }
  if (character !== '"') {
    return scan;
  }
  const lastTopString =
    scan.depth === TOP_LEVEL ? { text: request.text.slice(scan.stringStart + 1, request.position), start: scan.stringStart } : scan.lastTopString;
  return { ...scan, quoting: "outside", lastTopString, lastSignificant: character };
};

const listOpening = (request: { readonly scan: Scan; readonly position: number }): Scan["opened"] =>
  request.scan.depth === TOP_LEVEL && request.scan.lastSignificant === ":" && request.scan.lastTopString?.text === EXCEPTIONS_KEY
    ? { key: request.scan.lastTopString.start, open: request.position }
    : request.scan.opened;

const closedBounds = (request: { readonly scan: Scan; readonly position: number }): Scan["bounds"] =>
  request.scan.depth === TOP_LEVEL + 1 && request.scan.opened !== undefined && request.scan.bounds === undefined
    ? { ...request.scan.opened, close: request.position }
    : request.scan.bounds;

const structuralScan = (request: { readonly scan: Scan; readonly character: string; readonly position: number }): Scan => {
  const { scan, character, position } = request;
  if (character === '"') {
    return { ...scan, quoting: "inside", stringStart: position };
  }
  if (OPENERS.has(character)) {
    const opened = character === "[" ? listOpening({ scan, position }) : scan.opened;
    return { ...scan, depth: scan.depth + 1, opened, lastSignificant: character };
  }
  if (CLOSERS.has(character)) {
    return { ...scan, depth: scan.depth - 1, bounds: closedBounds({ scan, position }), lastSignificant: character };
  }
  return WHITESPACE.test(character) ? scan : { ...scan, lastSignificant: character };
};

const listBoundsIn = (request: { readonly text: string }): ListBounds | undefined =>
  request.text
    .split("")
    .map((character, position) => ({ character, position }))
    .reduce(
      (scan, placed) =>
        scan.quoting === "outside" ? structuralScan({ scan, ...placed }) : quotedScan({ scan, ...placed, text: request.text }),
      STARTING_SCAN,
    ).bounds;

const renderedEntries = (request: {
  readonly entries: readonly ExceptionEntry[];
  readonly indent: string;
  readonly lineBreak: string;
}): string =>
  request.entries
    .map((entry) =>
      JSON.stringify(entry, null, INDENT_STEP.length)
        .split("\n")
        .map((line) => `${request.indent}${line}`)
        .join(request.lineBreak),
    )
    .join(`,${request.lineBreak}`);

const lastContentBefore = (request: { readonly text: string; readonly bounds: ListBounds }): number =>
  request.text.slice(request.bounds.open + 1, request.bounds.close).trimEnd().length + request.bounds.open;

const appendedText = (request: {
  readonly text: string;
  readonly bounds: ListBounds;
  readonly entries: readonly ExceptionEntry[];
}): string => {
  const { text, bounds } = request;
  const lineBreak = text.includes("\r\n") ? "\r\n" : "\n";
  const keyIndent = LINE_START_INDENT.exec(text.slice(0, bounds.key).split("\n").at(-1) ?? "")?.[0] ?? "";
  const rendered = renderedEntries({ entries: request.entries, indent: `${keyIndent}${INDENT_STEP}`, lineBreak });
  const lastContent = lastContentBefore({ text, bounds });
  return lastContent === bounds.open
    ? `${text.slice(0, bounds.open + 1)}${lineBreak}${rendered}${lineBreak}${keyIndent}${text.slice(bounds.close)}`
    : `${text.slice(0, lastContent + 1)},${lineBreak}${rendered}${text.slice(lastContent + 1)}`;
};

export const exceptionsTextWith = (request: {
  readonly text: string | undefined;
  readonly entries: readonly ExceptionEntry[];
}): Result<string, { readonly detail: string }> => {
  if (request.text === undefined) {
    return { outcome: "ok", value: `${JSON.stringify({ version: 1, exceptions: request.entries }, null, INDENT_STEP.length)}\n` };
  }
  if (request.entries.length === 0) {
    return { outcome: "ok", value: request.text };
  }
  const bounds = listBoundsIn({ text: request.text });
  return bounds === undefined
    ? { outcome: "failed", error: { detail: "holds no top-level exceptions list to add records to" } }
    : { outcome: "ok", value: appendedText({ text: request.text, bounds, entries: request.entries }) };
};
