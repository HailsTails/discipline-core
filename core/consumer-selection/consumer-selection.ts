import { eslintConfigLookupSchema } from "../values/eslint-config-lookup.ts";
import { fileExceptionWhyChainsSchema } from "../values/file-exception-why-chains.ts";
import { type ReportOutput, reportOutputSchema } from "../values/report-output.ts";
import { z } from "zod";
import type { LoadFailure } from "../check/load-failure.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../platform-ports/file-text-port.ts";
import { createDefaultPathPort, type PathPort } from "../platform-ports/path-port.ts";
import {
  type ClauseExceptions,
  type DisciplineFile,
  disciplineFilePath,
  type PieceFile,
  pieceFilePath,
  readDisciplineFile,
  readPieceFile,
  readVersionOneJson,
} from "../rule-set-reader/rule-set-reader.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { brandedRepoPathSchema, type RepoPath, repoPathSchema, repoPathTextSchema } from "../values/repo-path.ts";
import {
  type ClauseAddress,
  clauseAddressSchema,
  clauseAddressText,
  sameClauseAddress,
  TOOL_RULE_SET,
} from "../values/clause-address.ts";
import {
  type MechanismId,
  mechanismIdSchema,
  ruleSetNameSchema,
} from "../values/identifiers.ts";
import { type ModuleExtension, runnerModuleSegmentsOf } from "../values/install-layout.ts";
import type { Result } from "../values/result.ts";
import { clauseSettingsSchema, settledPieceSettings } from "./clause-settings.ts";
import type { ClauseBinding, SelectionReading } from "./selection.ts";

export type { SelectedClause, Selection, ClauseBinding, SelectionReading } from "./selection.ts";

export type SelectionRepository = {
  readonly read: (request: Record<string, never>) => Result<SelectionReading, LoadFailure>;
};

export const createSelectionRepository = (options: {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
}): SelectionRepository => ({
  read: (_request) => readSelection(options),
});

export const createDefaultSelectionRepository = (options: {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
}): SelectionRepository => createSelectionRepository({
  ...options,
  fileText: createDefaultFileTextPort({}),
  path: createDefaultPathPort({}),
});

type ResolvedClause = {
  readonly ruleSetRoot: AbsolutePath;
  readonly discipline: DisciplineFile;
  readonly piece: PieceFile;
  readonly binding: ClauseBinding;
  readonly exceptions: ClauseExceptions;
};

const RULE_SET_SUFFIX_SEPARATOR = "-";

const CLAUSE_ADDRESS_RULE_SET_SEPARATOR = "/";

export type RuleSetLocation =
  | { readonly location: "repo-root" }
  | { readonly location: "folder"; readonly path: RepoPath };

const LEADING_CURRENT_DIRECTORY = "./";

const ruleSetLocationSchema = z.union([
  z.enum([".", LEADING_CURRENT_DIRECTORY]).transform((): RuleSetLocation => ({ location: "repo-root" })),
  z
    .string()
    .transform((text) =>
      text.startsWith(LEADING_CURRENT_DIRECTORY) ? text.slice(LEADING_CURRENT_DIRECTORY.length) : text,
    )
    .pipe(repoPathSchema)
    .transform((path): RuleSetLocation => ({ location: "folder", path })),
]);

const consumerSelectionFileSchema = z.strictObject({
  version: z.literal(1),
  ruleSets: z
    .record(ruleSetNameSchema, z.string())
    .transform((ruleSets) => Object.entries(ruleSets))
    .pipe(z.array(z.tuple([ruleSetNameSchema, ruleSetLocationSchema]))),
  clauses: z
    .record(z.string(), z.string())
    .transform((clauses) => Object.entries(clauses))
    .pipe(z.array(z.tuple([clauseAddressSchema, mechanismIdSchema]))),
  exclude: z
    .array(
      brandedRepoPathSchema({
        text: repoPathTextSchema.refine((excludedPath) => !excludedPath.includes("*"), {
          error: "an exclude entry is a repository path, not a glob",
        }),
      }),
    )
    .default([]),
  eslintConfigLookup: eslintConfigLookupSchema.optional(),
  fileExceptionWhyChains: fileExceptionWhyChainsSchema.default("required"),
  reportOutput: reportOutputSchema.default("full"),
  clauseSettings: clauseSettingsSchema.default([]),
}).superRefine((file, context) => {
  file.clauseSettings
    .filter(([address]) => !file.clauses.some(([selected]) => sameClauseAddress({ left: selected, right: address }) === "same"))
    .forEach(([address]) => {
      context.addIssue({
        code: "custom",
        path: ["clauseSettings", clauseAddressText({ address })],
        message: "clauseSettings names a clause that clauses does not select",
      });
    });
});

type ConsumerSelectionFile = z.infer<typeof consumerSelectionFileSchema>;

const failed = (error: LoadFailure): { readonly outcome: "failed"; readonly error: LoadFailure } => ({
  outcome: "failed",
  error,
});

export const ruleSetRootOf = (request: {
  readonly ruleSet: ClauseAddress["ruleSet"];
  readonly ruleSets: Readonly<Record<string, RuleSetLocation>>;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly path: PathPort;
}): Result<AbsolutePath, LoadFailure> => {
  const ruleSet = request.ruleSet;
  if (ruleSet === TOOL_RULE_SET) {
    return { outcome: "ok", value: request.installRoot };
  }
  const declared = Object.entries(request.ruleSets).find(([name]) => name === ruleSet.name);
  if (declared === undefined) {
    return failed({ kind: "unknown-rule-set", name: ruleSet.name });
  }
  const location = declared[1];
  if (location.location === "repo-root") {
    return { outcome: "ok", value: request.repoRoot };
  }
  const directory = request.path.join({ segments: [request.repoRoot, location.path] });
  const resolved = request.path.resolve({ path: directory });
  if (resolved.outcome === "failed") {
    return failed({
      kind: "rule-set-invalid",
      path: directory,
      detail: `the directory of rule set ${ruleSet.name} resolves to no absolute path`,
    });
  }
  return { outcome: "ok", value: resolved.value };
};

type ClauseRequest = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly ruleSetRoot: AbsolutePath;
  readonly address: ClauseAddress;
  readonly mechanism: MechanismId;
  readonly earlier: readonly ResolvedClause[];
};

type MechanicalDefinition = Extract<DisciplineFile["clauses"][number], { readonly kind: "mechanical" }>;

type DefinedClause = {
  readonly discipline: DisciplineFile;
  readonly definition: MechanicalDefinition;
};

const disciplineOf = (request: ClauseRequest): Result<DisciplineFile, LoadFailure> => {
  const loaded = request.earlier.find(
    (earlier) =>
      earlier.ruleSetRoot === request.ruleSetRoot && earlier.discipline.id === request.address.discipline,
  );
  if (loaded !== undefined) {
    return { outcome: "ok", value: loaded.discipline };
  }
  const location = { path: request.path, ruleSetRoot: request.ruleSetRoot, discipline: request.address.discipline };
  if (request.fileText.exists({ path: disciplineFilePath(location) }) === "absent") {
    return failed({ kind: "unknown-discipline", address: clauseAddressText({ address: request.address }) });
  }
  return readDisciplineFile({ ...location, fileText: request.fileText });
};

const definedClause = (request: ClauseRequest): Result<DefinedClause, LoadFailure> => {
  const address = clauseAddressText({ address: request.address });
  const discipline = disciplineOf(request);
  if (discipline.outcome === "failed") {
    return discipline;
  }
  const definition = discipline.value.clauses.find((clause) => clause.id === request.address.clause);
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

type PieceRequest = ClauseRequest & { readonly discipline: DisciplineFile };

const pieceOf = (request: PieceRequest): Result<PieceFile, LoadFailure> => {
  const loaded = request.earlier.find(
    (earlier) =>
      earlier.ruleSetRoot === request.ruleSetRoot &&
      earlier.discipline.id === request.address.discipline &&
      earlier.binding.mechanism === request.mechanism,
  );
  if (loaded !== undefined) {
    return { outcome: "ok", value: loaded.piece };
  }
  const location = {
    path: request.path,
    ruleSetRoot: request.ruleSetRoot,
    discipline: request.address.discipline,
    mechanism: request.mechanism,
  };
  if (request.fileText.exists({ path: pieceFilePath(location) }) === "absent") {
    return failed({
      kind: "piece-missing",
      address: clauseAddressText({ address: request.address }),
      mechanism: request.mechanism,
    });
  }
  return readPieceFile({ ...location, fileText: request.fileText, discipline: request.discipline });
};

type PieceEntry = { readonly piece: PieceFile; readonly settings: unknown };

const pieceEntry = (request: PieceRequest): Result<PieceEntry, LoadFailure> => {
  const runnerPath = request.path.join({
    segments: runnerModuleSegmentsOf({ installRoot: request.installRoot, mechanism: request.mechanism, moduleExtension: request.moduleExtension }),
  });
  if (request.fileText.exists({ path: runnerPath }) === "absent") {
    return failed({ kind: "runner-missing", mechanism: request.mechanism });
  }
  const piece = pieceOf(request);
  if (piece.outcome === "failed") {
    return piece;
  }
  const entry = piece.value.clauses.find((candidate) => candidate.clause === request.address.clause);
  if (entry === undefined) {
    return failed({
      kind: "piece-missing",
      address: clauseAddressText({ address: request.address }),
      mechanism: request.mechanism,
    });
  }
  return { outcome: "ok", value: { piece: piece.value, settings: entry.settings } };
};

const resolvedClauseOf = (request: {
  readonly clauseRequest: ClauseRequest;
  readonly defined: DefinedClause;
  readonly entry: PieceEntry;
}): ResolvedClause => {
  const { clauseRequest, defined, entry } = request;
  return {
    ruleSetRoot: clauseRequest.ruleSetRoot,
    discipline: defined.discipline,
    piece: entry.piece,
    exceptions: defined.definition.exceptions,
    binding: {
      mechanism: clauseRequest.mechanism,
      clause: {
        address: clauseRequest.address,
        anchor: defined.definition.anchor,
        pieceRoot: clauseRequest.path.join({
          segments: [clauseRequest.ruleSetRoot, "mechanisms", clauseRequest.mechanism, clauseRequest.address.discipline],
        }),
        settings: entry.settings,
      },
    },
  };
};

const resolveClause = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly ruleSets: ConsumerSelectionFile["ruleSets"];
  readonly address: ClauseAddress;
  readonly mechanism: MechanismId;
  readonly earlier: readonly ResolvedClause[];
}): Result<ResolvedClause, LoadFailure> => {
  const root = ruleSetRootOf({ ...request, ruleSet: request.address.ruleSet, ruleSets: Object.fromEntries(request.ruleSets) });
  if (root.outcome === "failed") {
    return root;
  }
  const clauseRequest = { ...request, ruleSetRoot: root.value };
  const defined = definedClause(clauseRequest);
  if (defined.outcome === "failed") {
    return defined;
  }
  const entry = pieceEntry({ ...clauseRequest, discipline: defined.value.discipline });
  if (entry.outcome === "failed") {
    return entry;
  }
  return { outcome: "ok", value: resolvedClauseOf({ clauseRequest, defined: defined.value, entry: entry.value }) };
};

const addressOf = (request: { readonly resolved: ResolvedClause }): ClauseAddress =>
  request.resolved.binding.clause.address;

const occurrenceInDiscipline = (request: {
  readonly resolved: readonly ResolvedClause[];
  readonly clause: ResolvedClause;
  readonly index: number;
}): "first" | "repeat" => {
  const address = addressOf({ resolved: request.clause });
  const firstIndex = request.resolved.findIndex(
    (earlier) =>
      sameClauseAddress({ left: { ...addressOf({ resolved: earlier }), clause: address.clause }, right: address }) ===
      "same",
  );
  return firstIndex === request.index ? "first" : "repeat";
};

const listingOf = (request: {
  readonly resolved: readonly ResolvedClause[];
  readonly address: ClauseAddress;
}): "listed" | "unlisted" =>
  request.resolved.some(
    (listed) => sameClauseAddress({ left: addressOf({ resolved: listed }), right: request.address }) === "same",
  )
    ? "listed"
    : "unlisted";

const unlistedClausesOf = (request: {
  readonly resolved: readonly ResolvedClause[];
  readonly representative: ResolvedClause;
}): readonly ClauseAddress[] =>
  request.representative.discipline.clauses
    .filter((definition) => definition.kind === "mechanical")
    .map((definition): ClauseAddress => ({ ...addressOf({ resolved: request.representative }), clause: definition.id }))
    .filter((address) => listingOf({ resolved: request.resolved, address }) === "unlisted");

const uncoveredClauses = (request: {
  readonly resolved: readonly ResolvedClause[];
}): readonly ClauseAddress[] =>
  request.resolved
    .filter((clause, index) => occurrenceInDiscipline({ resolved: request.resolved, clause, index }) === "first")
    .flatMap((representative) => unlistedClausesOf({ resolved: request.resolved, representative }));

const resolvedClauses = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly file: ConsumerSelectionFile;
}): Result<readonly ResolvedClause[], LoadFailure> =>
  request.file.clauses.reduce<Result<readonly ResolvedClause[], LoadFailure>>(
    (sofar, [address, mechanism]) =>
      appendedClause({
        sofar,
        resolve: ({ earlier }) =>
          resolveClause({ ...request, ruleSets: request.file.ruleSets, address, mechanism, earlier }),
      }),
    { outcome: "ok", value: [] },
  );

const appendedClause = (request: {
  readonly sofar: Result<readonly ResolvedClause[], LoadFailure>;
  readonly resolve: (resolution: { readonly earlier: readonly ResolvedClause[] }) => Result<ResolvedClause, LoadFailure>;
}): Result<readonly ResolvedClause[], LoadFailure> => {
  if (request.sofar.outcome === "failed") {
    return request.sofar;
  }
  const clause = request.resolve({ earlier: request.sofar.value });
  if (clause.outcome === "failed") {
    return clause;
  }
  return { outcome: "ok", value: [...request.sofar.value, clause.value] };
};

const parsedSelectionFile = (request: {
  readonly fileText: FileTextPort;
  readonly path: string;
}): Result<ConsumerSelectionFile, LoadFailure> => {
  const document = readVersionOneJson(request);
  if (document.outcome === "failed") {
    return document;
  }
  const parsed = consumerSelectionFileSchema.safeParse(document.value);
  if (!parsed.success) {
    return failed({ kind: "file-malformed", path: request.path, detail: z.prettifyError(parsed.error) });
  }
  const refusal = selectionFileRefusalOf({ file: parsed.data });
  return refusal === undefined ? { outcome: "ok", value: parsed.data } : failed(refusal);
};

const reservedRuleSetNameRefusalOf = (request: { readonly file: ConsumerSelectionFile }): LoadFailure | undefined => {
  const reserved = request.file.ruleSets.find(
    ([name]) => name === TOOL_RULE_SET || name.startsWith(`${TOOL_RULE_SET}${RULE_SET_SUFFIX_SEPARATOR}`),
  );
  return reserved === undefined ? undefined : { kind: "reserved-rule-set-name", name: reserved[0] };
};

const ruleSetNameCollisionRefusalOf = (request: { readonly file: ConsumerSelectionFile }): LoadFailure | undefined => {
  const names = request.file.ruleSets.map(([name]) => name);
  const collisions = names.flatMap((name) =>
    names
      .filter((candidate) => candidate.startsWith(`${name}${RULE_SET_SUFFIX_SEPARATOR}`))
      .map((other) => ({ kind: "rule-set-name-collision" as const, name, other })),
  );
  return collisions[0];
};

const duplicateClauseRefusalOf = (request: { readonly file: ConsumerSelectionFile }): LoadFailure | undefined => {
  const addresses = request.file.clauses.map(([address]) => address);
  const repeated = addresses.find(
    (address, index) =>
      addresses.slice(0, index).some((earlier) => sameClauseAddress({ left: earlier, right: address }) === "same"),
  );
  if (repeated === undefined) {
    return undefined;
  }
  const address = clauseAddressText({ address: repeated });
  return { kind: "duplicate-clause", address, prefixedAddress: `${TOOL_RULE_SET}${CLAUSE_ADDRESS_RULE_SET_SEPARATOR}${address}` };
};

const selectionFileRefusalOf = (request: { readonly file: ConsumerSelectionFile }): LoadFailure | undefined =>
  reservedRuleSetNameRefusalOf(request) ?? ruleSetNameCollisionRefusalOf(request) ?? duplicateClauseRefusalOf(request);

const selectionReadingOf = (request: {
  readonly resolved: readonly ResolvedClause[];
  readonly file: ConsumerSelectionFile;
}): SelectionReading => ({
  selection: {
    selected: request.resolved.map(({ binding, exceptions }) => ({
      address: binding.clause.address,
      mechanism: binding.mechanism,
      exceptions,
    })),
    uncovered: uncoveredClauses(request),
  },
  bindings: request.resolved.map(({ binding }) => binding),
  excluded: request.file.exclude,
  fileExceptionWhyChains: request.file.fileExceptionWhyChains,
});

const givenClauseSettings = (request: {
  readonly file: ConsumerSelectionFile;
  readonly address: ClauseAddress;
}): Readonly<Record<string, unknown>> | undefined =>
  request.file.clauseSettings.find(([address]) => sameClauseAddress({ left: address, right: request.address }) === "same")?.[1];

const settledClause = (request: {
  readonly clause: ResolvedClause;
  readonly file: ConsumerSelectionFile;
  readonly path: string;
}): Result<ResolvedClause, LoadFailure> => {
  const address = addressOf({ resolved: request.clause });
  const settings = settledPieceSettings({
    address,
    pieceSettings: request.clause.binding.clause.settings,
    given: givenClauseSettings({ file: request.file, address }),
  });
  if (settings.outcome === "failed") {
    return failed({ kind: "file-malformed", path: request.path, detail: settings.error });
  }
  const { binding } = request.clause;
  return { outcome: "ok", value: { ...request.clause, binding: { ...binding, clause: { ...binding.clause, settings: settings.value } } } };
};

const withClauseSettings = (request: {
  readonly resolved: readonly ResolvedClause[];
  readonly file: ConsumerSelectionFile;
  readonly path: string;
}): Result<readonly ResolvedClause[], LoadFailure> =>
  request.resolved.reduce<Result<readonly ResolvedClause[], LoadFailure>>(
    (sofar, clause) =>
      appendedClause({ sofar, resolve: () => settledClause({ clause, file: request.file, path: request.path }) }),
    { outcome: "ok", value: [] },
  );

const selectionFilePath = (request:{ readonly path: PathPort; readonly repoRoot: AbsolutePath }): string =>
  request.path.join({ segments: [request.repoRoot, "disciplines.json"] });

export const readReportOutput = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): Result<ReportOutput, LoadFailure> => {
  const file = parsedSelectionFile({ fileText: request.fileText, path: selectionFilePath(request) });
  if (file.outcome === "failed") {
    return file;
  }
  return { outcome: "ok", value: file.value.reportOutput };
};

export const readSelection = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
}): Result<SelectionReading, LoadFailure> => {
  const file = parsedSelectionFile({ fileText: request.fileText, path: selectionFilePath(request) });
  if (file.outcome === "failed") {
    return file;
  }
  const resolved = resolvedClauses({ ...request, file: file.value });
  if (resolved.outcome === "failed") {
    return resolved;
  }
  const settled = withClauseSettings({ resolved: resolved.value, file: file.value, path: selectionFilePath(request) });
  if (settled.outcome === "failed") {
    return settled;
  }
  return { outcome: "ok", value: selectionReadingOf({ resolved: settled.value, file: file.value }) };
};
