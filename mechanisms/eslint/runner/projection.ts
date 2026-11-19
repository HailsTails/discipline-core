import type { ExceptionRecord } from "../../../core/exception-records/exception-records.ts";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { ProjectionWrite } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { FileRemovalPort } from "../../../core/platform-ports/file-removal-port.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import { gatheredOutcomes, listedOutcome } from "../../../core/values/gathered-outcomes.ts";
import {
  type ClauseAddress,
  clauseAddressText,
  sameClauseAddress,
} from "../../../core/values/clause-address.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { CoreInstall } from "./core-install.ts";
import { enabledRuleEntry, reservedNamespace } from "./eslint-instance.ts";
import type { RuleOptions } from "./eslint-piece-settings-schema.ts";
import type { ProjectionStates } from "./projection-states.ts";

export type ProjectedClause = {
  readonly address: ClauseAddress;
  readonly ruleId: string;
  readonly options: RuleOptions;
};

export type PluginImport =
  | { readonly placement: "importable"; readonly specifier: string }
  | { readonly placement: "piece-on-another-root" };

export type ProjectedPiece = {
  readonly pluginNamespace: string;
  readonly pluginImport: string;
  readonly clauses: readonly ProjectedClause[];
};

export type CurrentProjection =
  | { readonly presence: "absent" }
  | { readonly presence: "present"; readonly text: string };

export type GeneratedProjectionState = "current" | "out-of-date" | "missing";

type RuleLine = { readonly ruleId: string; readonly entry: string };

type FileRecord = Exclude<ExceptionRecord, { readonly kind: "clause-wide-carve-out" }>;

type ClauseWideRecord = Extract<ExceptionRecord, { readonly kind: "clause-wide-carve-out" }>;

type FileClauses = {
  readonly file: RepoPath;
  readonly clauses: readonly ClauseAddress[];
  readonly clausesText: string;
};

type FileRecordGroup = {
  readonly clausesText: string;
  readonly clauses: readonly ClauseAddress[];
  readonly files: readonly RepoPath[];
};

export const PROJECTION_PATH: RepoPath = repoPathSchema.parse("disciplines.eslint.mjs");

const SOURCE_FILES = "**/*.{ts,tsx,mts,cts}";

const GLOB_SPECIAL_CHARACTERS = /[\\*?[\]{}()!+@]/g;

const PARENT_PREFIX = "../";

const FILE_RECORDS_CATEGORY = "file-records";

const CLAUSE_SEPARATOR = ", ";

const codeUnitOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left < request.right) {
    return -1;
  }
  return request.left > request.right ? 1 : 0;
};

const quoted = (request: { readonly text: string }): string => JSON.stringify(request.text);

export const escapedGlobPath = (request: { readonly path: string }): string =>
  request.path.replace(GLOB_SPECIAL_CHARACTERS, (character) => `\\${character}`);

const relativeImportOf = (request: {
  readonly path: PathPort;
  readonly importingDirectory: AbsolutePath;
  readonly modulePath: string;
}): PluginImport => {
  const location = request.path.relative({ from: request.importingDirectory, to: request.modulePath });
  if (location.relation === "different-root") {
    return { placement: "piece-on-another-root" };
  }
  return {
    placement: "importable",
    specifier: location.path.startsWith(PARENT_PREFIX) ? location.path : `./${location.path}`,
  };
};

const pathInsidePackage = (request: {
  readonly path: PathPort;
  readonly packageRoot: string;
  readonly modulePath: string;
}): string | undefined => {
  const location = request.path.relative({ from: request.packageRoot, to: request.modulePath });
  return location.relation === "within-root" && !location.path.startsWith(PARENT_PREFIX) ? location.path : undefined;
};

const packageImportOf = (request: {
  readonly path: PathPort;
  readonly install: Extract<CoreInstall, { readonly form: "package" }>;
  readonly modulePath: string;
}): PluginImport | undefined => {
  const inside = pathInsidePackage({ path: request.path, packageRoot: request.install.root, modulePath: request.modulePath });
  return inside === undefined ? undefined : { placement: "importable", specifier: `${request.install.name}/${inside}` };
};

export const pluginImportOf = (request: {
  readonly path: PathPort;
  readonly importingDirectory: AbsolutePath;
  readonly install: CoreInstall;
  readonly pieceRoot: string;
  readonly pluginModule: string;
}): PluginImport => {
  const modulePath = request.path.join({ segments: [request.pieceRoot, request.pluginModule] });
  const packaged =
    request.install.form === "package" ? packageImportOf({ path: request.path, install: request.install, modulePath }) : undefined;
  return packaged ?? relativeImportOf({ path: request.path, importingDirectory: request.importingDirectory, modulePath });
};

const rulesLine = (request: { readonly rules: readonly RuleLine[] }): string =>
  `    rules: { ${[...request.rules]
    .sort((left, right) => codeUnitOrder({ left: left.ruleId, right: right.ruleId }))
    .map((rule) => `${quoted({ text: rule.ruleId })}: ${rule.entry}`)
    .join(", ")} },`;

const enabledLine = (request: { readonly clause: ProjectedClause }): RuleLine => ({
  ruleId: request.clause.ruleId,
  entry: JSON.stringify(enabledRuleEntry({ options: request.clause.options })),
});

const offLines = (request: { readonly ruleIds: readonly string[] }): readonly RuleLine[] =>
  request.ruleIds.map((ruleId) => ({ ruleId, entry: quoted({ text: "off" }) }));

const blockText = (request: { readonly lines: readonly string[] }): string =>
  ["  {", ...request.lines, "  },"].join("\n");

const pieceBlock = (request: {
  readonly piece: ProjectedPiece;
  readonly importName: string;
}): string =>
  blockText({
    lines: [
      `    name: ${quoted({ text: `${reservedNamespace}/piece/${request.piece.pluginNamespace}` })},`,
      `    files: [${quoted({ text: SOURCE_FILES })}],`,
      `    plugins: { ${quoted({ text: request.piece.pluginNamespace })}: ${request.importName} },`,
      rulesLine({ rules: request.piece.clauses.map((clause) => enabledLine({ clause })) }),
    ],
  });

const ruleIdsOfClause = (request: {
  readonly pieces: readonly ProjectedPiece[];
  readonly address: ClauseAddress;
}): readonly string[] =>
  request.pieces
    .flatMap((piece) => piece.clauses)
    .filter(
      (clause) => sameClauseAddress({ left: clause.address, right: request.address }) === "same",
    )
    .map((clause) => clause.ruleId)
    .sort((left, right) => codeUnitOrder({ left, right }));

const filesLines = (request: { readonly files: readonly RepoPath[] }): readonly string[] => [
  "    files: [",
  ...request.files.map((file) => `      ${quoted({ text: escapedGlobPath({ path: file }) })},`),
  "    ],",
];

const fileRecordGroupBlock = (request: {
  readonly group: FileRecordGroup;
  readonly pieces: readonly ProjectedPiece[];
}): string =>
  blockText({
    lines: [
      `    name: ${quoted({ text: `${reservedNamespace}/${FILE_RECORDS_CATEGORY}/${request.group.clausesText}` })},`,
      ...filesLines({ files: request.group.files }),
      rulesLine({
        rules: offLines({
          ruleIds: [
            ...new Set(
              request.group.clauses.flatMap((address) => ruleIdsOfClause({ pieces: request.pieces, address })),
            ),
          ],
        }),
      }),
    ],
  });

const clauseWideBlock = (request: {
  readonly record: ClauseWideRecord;
  readonly pieces: readonly ProjectedPiece[];
}): string =>
  blockText({
    lines: [
      `    name: ${quoted({
        text: `${reservedNamespace}/${request.record.kind}/${clauseAddressText({ address: request.record.clause })}`,
      })},`,
      rulesLine({ rules: offLines({ ruleIds: ruleIdsOfClause({ pieces: request.pieces, address: request.record.clause }) }) }),
    ],
  });

const clauseWideOrder = (request: { readonly left: ClauseWideRecord; readonly right: ClauseWideRecord }): number =>
  codeUnitOrder({
    left: clauseAddressText({ address: request.left.clause }),
    right: clauseAddressText({ address: request.right.clause }),
  });

const fileRecordsOf = (request: { readonly records: readonly ExceptionRecord[] }): readonly FileRecord[] =>
  request.records.flatMap((record) => (record.kind === "clause-wide-carve-out" ? [] : [record]));

const distinctSortedClauses = (request: { readonly clauses: readonly ClauseAddress[] }): readonly ClauseAddress[] =>
  [...new Map(request.clauses.map((address) => [clauseAddressText({ address }), address]))]
    .sort(([left], [right]) => codeUnitOrder({ left, right }))
    .map(([, address]) => address);

const clausesOfEachFile = (request: { readonly records: readonly FileRecord[] }): readonly FileClauses[] =>
  [...Map.groupBy(request.records, (record) => record.file)].map(([file, records]) => {
    const clauses = distinctSortedClauses({ clauses: records.map((record) => record.clause) });
    return {
      file,
      clauses,
      clausesText: clauses.map((address) => clauseAddressText({ address })).join(CLAUSE_SEPARATOR),
    };
  });

const fileRecordGroups = (request: { readonly records: readonly ExceptionRecord[] }): readonly FileRecordGroup[] =>
  [...Map.groupBy(clausesOfEachFile({ records: fileRecordsOf(request) }), (fileClauses) => fileClauses.clausesText)]
    .sort(([left], [right]) => codeUnitOrder({ left, right }))
    .map(([clausesText, sharers]) => ({
      clausesText,
      clauses: distinctSortedClauses({ clauses: sharers.flatMap((fileClauses) => fileClauses.clauses) }),
      files: sharers.map((fileClauses) => fileClauses.file).sort((left, right) => codeUnitOrder({ left, right })),
    }));

const sortedClauseWideRecords = (request: {
  readonly records: readonly ExceptionRecord[];
}): readonly ClauseWideRecord[] =>
  request.records
    .flatMap((record) => (record.kind === "clause-wide-carve-out" ? [record] : []))
    .sort((left, right) => clauseWideOrder({ left, right }));

const sortedPieces = (request: { readonly pieces: readonly ProjectedPiece[] }): readonly ProjectedPiece[] =>
  [...request.pieces].sort((left, right) =>
    codeUnitOrder({ left: left.pluginNamespace, right: right.pluginNamespace }),
  );

const importLines = (request: { readonly pieces: readonly ProjectedPiece[] }): readonly string[] =>
  request.pieces.map((piece, index) => `import piece${index} from ${quoted({ text: piece.pluginImport })};`);

const configBlocks = (request: {
  readonly pieces: readonly ProjectedPiece[];
  readonly records: readonly ExceptionRecord[];
}): readonly string[] => [
  ...request.pieces.map((piece, index) => pieceBlock({ piece, importName: `piece${index}` })),
  ...fileRecordGroups({ records: request.records }).map((group) =>
    fileRecordGroupBlock({ group, pieces: request.pieces }),
  ),
  ...sortedClauseWideRecords({ records: request.records }).map((record) =>
    clauseWideBlock({ record, pieces: request.pieces }),
  ),
];

export const projectionText = (request: {
  readonly selectedPieces: readonly ProjectedPiece[];
  readonly records: readonly ExceptionRecord[];
}): string => {
  const pieces = sortedPieces({ pieces: request.selectedPieces });
  const imports = importLines({ pieces });
  const blocks = configBlocks({ pieces, records: request.records });
  return `${imports.join("\n")}\n\nexport default [\n${blocks.join("\n")}\n];\n`;
};

export const projectionState = (request: {
  readonly current: CurrentProjection;
  readonly generated: string;
}): GeneratedProjectionState => {
  if (request.current.presence === "absent") {
    return "missing";
  }
  return request.current.text === request.generated ? "current" : "out-of-date";
};

type ProjectionFile = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly file: RepoPath;
};

export const currentProjection = (request: ProjectionFile): Result<CurrentProjection, RunnerFailure> => {
  const projectionFile = request.path.join({ segments: [request.repoRoot, request.file] });
  if (request.fileText.exists({ path: projectionFile }) === "absent") {
    return { outcome: "ok", value: { presence: "absent" } };
  }
  const text = request.fileText.read({ path: projectionFile });
  if (text.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", file: request.file, detail: text.error.detail },
    };
  }
  return { outcome: "ok", value: { presence: "present", text: text.value.replaceAll("\r\n", "\n") } };
};

const writtenProjection = (request: ProjectionFile & { readonly text: string }): Result<ProjectionWrite, RunnerFailure> => {
  const written = request.fileText.write({
    path: request.path.join({ segments: [request.repoRoot, request.file] }),
    text: request.text,
  });
  if (written.outcome === "failed") {
    return { outcome: "failed", error: { kind: "tool-failed", detail: written.error.detail } };
  }
  return { outcome: "ok", value: { path: request.file, effect: "written" } };
};

export const writeProjection = (request: ProjectionFile & { readonly text: string }): Result<ProjectionWrite, RunnerFailure> => {
  const current = currentProjection(request);
  if (current.outcome === "failed") {
    return current;
  }
  if (projectionState({ current: current.value, generated: request.text }) === "current") {
    return { outcome: "ok", value: { path: request.file, effect: "unchanged" } };
  }
  return writtenProjection(request);
};

const fileState = (request: ProjectionFile): Result<readonly [RepoPath, CurrentProjection], RunnerFailure> => {
  const current = currentProjection(request);
  return current.outcome === "failed" ? current : { outcome: "ok", value: [request.file, current.value] };
};

export const currentProjectionsOf = (
  request: Omit<ProjectionFile, "file"> & { readonly files: readonly RepoPath[] },
): Result<ProjectionStates, RunnerFailure> => {
  const states = gatheredOutcomes({ outcomes: request.files.map((file) => listedOutcome({ outcome: fileState({ ...request, file }) })) });
  return states.outcome === "failed" ? states : { outcome: "ok", value: new Map(states.value) };
};

export type ProjectionFiles = {
  readonly currentOf: (request: { readonly files: readonly RepoPath[] }) => Result<ProjectionStates, RunnerFailure>;
  readonly writeAt: (request: { readonly file: RepoPath; readonly text: string }) => Result<ProjectionWrite, RunnerFailure>;
  readonly removeAt: (request: { readonly file: RepoPath }) => Result<void, RunnerFailure>;
};

export const projectionFilesOver = (request: {
  readonly fileText: FileTextPort;
  readonly fileRemoval: FileRemovalPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): ProjectionFiles => ({
  currentOf: ({ files }) => currentProjectionsOf({ ...request, files }),
  writeAt: ({ file, text }) => writeProjection({ ...request, file, text }),
  removeAt: ({ file }) => {
    const removed = request.fileRemoval.remove({ path: request.path.join({ segments: [request.repoRoot, file] }) });
    return removed.outcome === "failed"
      ? { outcome: "failed", error: { kind: "tool-failed", detail: removed.error.detail } }
      : { outcome: "ok", value: undefined };
  },
});
