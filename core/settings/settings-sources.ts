import type { LoadFailure } from "../check/load-failure.ts";
import { ruleSetRootOf } from "../consumer-selection/consumer-selection.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { type DisciplineFile, disciplineFilePath, pieceFilePath, readDisciplineFile, readPieceFile } from "../rule-set-reader/rule-set-reader.ts";
import { createSymptomCatalogueRepository } from "../symptom-catalogue/read-symptom-catalogue.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { type ClauseAddress, clauseAddressText } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import { type ModuleExtension, runnerModuleSegmentsOf } from "../values/install-layout.ts";
import { parsedJson } from "../values/parsed-json.ts";
import type { Result } from "../values/result.ts";
import type { PieceClause, SettingsDocument, SettingsSources } from "./read-settings.ts";

export const SETTINGS_FILE_NAME = "hone.config.json";

type SourcesOptions = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
};

type PieceRequest = SourcesOptions & { readonly ruleSetRoot: AbsolutePath; readonly clause: ClauseAddress; readonly mechanism: MechanismId };

type MechanicalDefinition = Extract<DisciplineFile["clauses"][number], { readonly kind: "mechanical" }>;

const failed = (error: LoadFailure): { readonly outcome: "failed"; readonly error: LoadFailure } => ({ outcome: "failed", error });

const settingsDocumentOf = (request: SourcesOptions): Result<SettingsDocument, LoadFailure> => {
  const path = request.path.join({ segments: [request.repoRoot, SETTINGS_FILE_NAME] });
  if (request.fileText.exists({ path }) === "absent") {
    return failed({ kind: "selection-absent", repo: request.repoRoot });
  }
  const text = request.fileText.read({ path });
  if (text.outcome === "failed") {
    return failed({ kind: "file-unreadable", path, detail: text.error.detail });
  }
  const document = parsedJson({ text: text.value });
  return document.outcome === "failed"
    ? failed({ kind: "file-malformed", path, detail: document.error })
    : { outcome: "ok", value: { path, document: document.value } };
};

const mechanicalDefinitionOf = (request: PieceRequest): Result<{ readonly discipline: DisciplineFile; readonly definition: MechanicalDefinition }, LoadFailure> => {
  const address = clauseAddressText({ address: request.clause });
  const location = { path: request.path, ruleSetRoot: request.ruleSetRoot, discipline: request.clause.discipline };
  if (request.fileText.exists({ path: disciplineFilePath(location) }) === "absent") {
    return failed({ kind: "unknown-discipline", address });
  }
  const discipline = readDisciplineFile({ ...location, fileText: request.fileText });
  if (discipline.outcome === "failed") {
    return discipline;
  }
  const definition = discipline.value.clauses.find((clause) => clause.id === request.clause.clause);
  if (definition === undefined) {
    return failed({ kind: "unknown-clause", address });
  }
  if (definition.kind === "judgement") {
    return failed({ kind: "judgement-clause-selected", address });
  }
  if (!definition.mechanisms.includes(request.mechanism)) {
    return failed({ kind: "mechanism-not-allowed", address, mechanism: request.mechanism });
  }
  return { outcome: "ok", value: { discipline: discipline.value, definition } };
};

const pieceClauseOf = (request: PieceRequest): Result<PieceClause, LoadFailure> => {
  const defined = mechanicalDefinitionOf(request);
  if (defined.outcome === "failed") {
    return defined;
  }
  const runnerPath = request.path.join({
    segments: runnerModuleSegmentsOf({ installRoot: request.installRoot, mechanism: request.mechanism, moduleExtension: request.moduleExtension }),
  });
  if (request.fileText.exists({ path: runnerPath }) === "absent") {
    return failed({ kind: "runner-missing", mechanism: request.mechanism });
  }
  const address = clauseAddressText({ address: request.clause });
  const location = { path: request.path, ruleSetRoot: request.ruleSetRoot, discipline: request.clause.discipline, mechanism: request.mechanism };
  if (request.fileText.exists({ path: pieceFilePath(location) }) === "absent") {
    return failed({ kind: "piece-missing", address, mechanism: request.mechanism });
  }
  const piece = readPieceFile({ ...location, fileText: request.fileText, discipline: defined.value.discipline });
  if (piece.outcome === "failed") {
    return piece;
  }
  const entry = piece.value.clauses.find((candidate) => candidate.clause === request.clause.clause);
  if (entry === undefined) {
    return failed({ kind: "piece-missing", address, mechanism: request.mechanism });
  }
  return {
    outcome: "ok",
    value: {
      exceptions: defined.value.definition.exceptions,
      anchor: defined.value.definition.anchor,
      pieceRoot: request.path.join({ segments: [request.ruleSetRoot, "mechanisms", request.mechanism, request.clause.discipline] }),
      settings: entry.settings,
      declarations: entry.clauseSettings,
      editions: entry.editions,
    },
  };
};

export const createSettingsSources = (options: SourcesOptions): SettingsSources => ({
  settingsFile: (_request) => settingsDocumentOf(options),
  ruleSetRoot: (request) =>
    ruleSetRootOf({
      ...options,
      ruleSet: request.ruleSet,
      ruleSets: Object.fromEntries(request.ruleSets.map((declared) => [declared.name, declared.location])),
    }),
  catalogue: (request) => createSymptomCatalogueRepository({ fileText: options.fileText, path: options.path, ruleSetRoot: request.ruleSetRoot }).read({}),
  pieceClause: (request) => pieceClauseOf({ ...options, ...request }),
});
