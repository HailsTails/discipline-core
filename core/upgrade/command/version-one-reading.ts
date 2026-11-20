import type { SelectionRepository } from "../../consumer-selection/consumer-selection.ts";
import type { ConsumerSelectionFile } from "../../consumer-selection/selection-file.ts";
import { readSelectionFile, selectionFilePathOf } from "../../consumer-selection/selection-reader.ts";
import type { LoadFailure } from "../../command-line/load-failure.ts";
import type { FileTextPort } from "../../platform-ports/file-text-port.ts";
import type { PathPort } from "../../platform-ports/path-port.ts";
import type { AbsolutePath } from "../../values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import { type HeadRecordsRefusal, headRecordsOf } from "../version-one-head/head-records.ts";
import { type ExceptionRepository, type PlacedEntry, UNMEASURED_EXCEPTION_BASELINE } from "../version-one-records/exception-records.ts";
import type { VersionOneReading } from "../proof/upgrade-plan.ts";
import type { VersionOneFiles, VersionOneRecordsRoot } from "../proof/upgrade-proof.ts";
import { type TeamConfigRefusal, teamConfigOf } from "./team-config-finder.ts";

const VERSION_ONE_SETTINGS = repoPathSchema.parse("disciplines.json");

const SPLIT_RECORDS_FOLDER = repoPathSchema.parse("discipline-exceptions");

export type VersionOneRead = { readonly reading: VersionOneReading; readonly versionOneFiles: VersionOneFiles };

export type VersionOneReadFailure =
  | { readonly kind: "version-one-unreadable"; readonly failure: LoadFailure }
  | { readonly kind: "records-refused"; readonly refusal: HeadRecordsRefusal }
  | { readonly kind: "several-version-one-projections"; readonly projections: readonly RepoPath[] }
  | { readonly kind: "team-config-refused"; readonly refusal: TeamConfigRefusal };

export type VersionOneReadRequest = {
  readonly repoRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly selectionRepository: SelectionRepository;
  readonly exceptionRepository: Pick<ExceptionRepository, "read">;
  readonly trackedPaths: readonly RepoPath[];
};

const projectionsPresentOf = (request: { readonly selection: ConsumerSelectionFile; readonly repoRoot: AbsolutePath; readonly fileText: Pick<FileTextPort, "exists">; readonly path: PathPort }): readonly RepoPath[] => {
  const mechanisms = new Set(request.selection.clauses.flatMap(([, choice]) => (choice.state === "run" ? [choice.mechanism] : [])));
  return [...mechanisms]
    .map((mechanism) => repoPathSchema.parse(`disciplines.${mechanism}.mjs`))
    .filter((projection) => request.fileText.exists({ path: request.path.join({ segments: [request.repoRoot, projection] }) }) === "present");
};

const recordsRootOf = (request: { readonly entries: readonly PlacedEntry[] }): VersionOneRecordsRoot =>
  request.entries.some(({ place }) => place.layout === "single-file") ? { kind: "repository" } : { kind: "folder", folder: SPLIT_RECORDS_FOLDER };

const recordsFilesOf = (request: { readonly entries: readonly PlacedEntry[] }): readonly RepoPath[] => [...new Set(request.entries.map(({ place }) => place.file))];

export const versionOneReadOf = (request: VersionOneReadRequest): Result<VersionOneRead, VersionOneReadFailure> => {
  const unreadable = (failure: LoadFailure): Result<never, VersionOneReadFailure> => ({ outcome: "failed", error: { kind: "version-one-unreadable", failure } });
  const file = readSelectionFile({ fileText: request.fileText, path: selectionFilePathOf({ path: request.path, repoRoot: request.repoRoot }) });
  if (file.outcome === "failed") {
    return unreadable(file.error);
  }
  const selected = request.selectionRepository.read({});
  if (selected.outcome === "failed") {
    return unreadable(selected.error);
  }
  const entries = request.exceptionRepository.read();
  if (entries.outcome === "failed") {
    return unreadable(entries.error);
  }
  const heads = headRecordsOf({
    entries: entries.value,
    selection: selected.value.selection,
    fileExceptionWhyChains: selected.value.fileExceptionWhyChains,
    baseline: UNMEASURED_EXCEPTION_BASELINE,
  });
  if (heads.outcome === "failed") {
    return { outcome: "failed", error: { kind: "records-refused", refusal: heads.error } };
  }
  const projections = projectionsPresentOf({ ...request, selection: file.value });
  if (projections.length > 1) {
    return { outcome: "failed", error: { kind: "several-version-one-projections", projections } };
  }
  const [versionOneProjection] = projections;
  const teamConfig = teamConfigOf({ repoRoot: request.repoRoot, fileText: request.fileText, path: request.path, trackedPaths: request.trackedPaths, projection: versionOneProjection });
  if (teamConfig.outcome === "failed") {
    return { outcome: "failed", error: { kind: "team-config-refused", refusal: teamConfig.error } };
  }
  return {
    outcome: "ok",
    value: {
      reading: { selection: file.value, heads: heads.value, teamConfig: teamConfig.value, versionOneProjection },
      versionOneFiles: {
        recordsFiles: recordsFilesOf({ entries: entries.value }),
        recordsRoot: recordsRootOf({ entries: entries.value }),
        settings: VERSION_ONE_SETTINGS,
      },
    },
  };
};
