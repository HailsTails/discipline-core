import type { ExceptionRecord } from "../../../core/exception-records/exception-records.ts";
import type { SliceProblem } from "../../../core/mechanism-port/embedded-run-report-schema.ts";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { ProjectionWrite } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { FileRemovalPort } from "../../../core/platform-ports/file-removal-port.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../../core/values/absolute-path.ts";
import type { ClauseAddress } from "../../../core/values/clause-address.ts";
import { gatheredOutcomes } from "../../../core/values/gathered-outcomes.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { CoreInstall } from "./core-install.ts";
import type { RuleOptions } from "./eslint-piece-settings-schema.ts";
import {
  currentProjection,
  type ProjectedPiece,
  pluginImportOf,
  projectionState,
  projectionText,
  writeProjection,
} from "./projection.ts";
import { type ConfigRoot, orphanedSliceDirectoriesOf, sliceRecordsOf, slicePathOf } from "./projection-slices.ts";

export type ProjectionClause = {
  readonly address: ClauseAddress;
  readonly ruleId: string;
  readonly options: RuleOptions;
  readonly pluginNamespace: string;
  readonly pieceRoot: string;
  readonly pluginModule: string;
};

export type SliceOrigin = {
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly install: CoreInstall;
};

type Outcome<Value> = Result<Value, RunnerFailure>;

type SliceSource = {
  readonly clauses: readonly ProjectionClause[];
  readonly records: readonly ExceptionRecord[];
  readonly origin: SliceOrigin;
};

const importingDirectoryOf = (request: { readonly origin: SliceOrigin; readonly root: ConfigRoot }): AbsolutePath =>
  request.root.placement === "repository"
    ? request.origin.repoRoot
    : absolutePathSchema.parse(request.origin.path.join({ segments: [request.origin.repoRoot, request.root.directory] }));

const namespaceLeaders = (request: { readonly clauses: readonly ProjectionClause[] }): readonly ProjectionClause[] =>
  request.clauses.filter(
    (entry, index) => request.clauses.findIndex((other) => other.pluginNamespace === entry.pluginNamespace) === index,
  );

const projectedPieceOf = (request: {
  readonly leader: ProjectionClause;
  readonly clauses: readonly ProjectionClause[];
  readonly importingDirectory: AbsolutePath;
  readonly origin: SliceOrigin;
}): Outcome<readonly ProjectedPiece[]> => {
  const pluginImport = pluginImportOf({
    path: request.origin.path,
    importingDirectory: request.importingDirectory,
    install: request.origin.install,
    pieceRoot: request.leader.pieceRoot,
    pluginModule: request.leader.pluginModule,
  });
  if (pluginImport.placement === "piece-on-another-root") {
    return {
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: request.leader.pieceRoot,
        detail: "the piece is on a different root from the repository, so the committed projection cannot import it by a relative path",
      },
    };
  }
  return {
    outcome: "ok",
    value: [
      {
        pluginNamespace: request.leader.pluginNamespace,
        pluginImport: pluginImport.specifier,
        clauses: request.clauses
          .filter((entry) => entry.pluginNamespace === request.leader.pluginNamespace)
          .map((entry) => ({ address: entry.address, ruleId: entry.ruleId, options: entry.options })),
      },
    ],
  };
};

export const sliceTextOf = (request: SliceSource & { readonly root: ConfigRoot }): Outcome<string> => {
  const importingDirectory = importingDirectoryOf(request);
  const pieces = gatheredOutcomes({
    outcomes: namespaceLeaders(request).map((leader) =>
      projectedPieceOf({ leader, clauses: request.clauses, importingDirectory, origin: request.origin }),
    ),
  });
  if (pieces.outcome === "failed") {
    return pieces;
  }
  return {
    outcome: "ok",
    value: projectionText({ selectedPieces: pieces.value, records: sliceRecordsOf(request) }),
  };
};

const packageSliceProblem = (
  request: SliceSource & { readonly fileText: FileTextPort; readonly root: ConfigRoot },
): Outcome<readonly SliceProblem[]> => {
  const slice = slicePathOf(request);
  const generated = sliceTextOf(request);
  if (generated.outcome === "failed") {
    return generated;
  }
  const current = currentProjection({
    fileText: request.fileText,
    path: request.origin.path,
    repoRoot: request.origin.repoRoot,
    file: slice,
  });
  if (current.outcome === "failed") {
    return current;
  }
  const state = projectionState({ current: current.value, generated: generated.value });
  return { outcome: "ok", value: state === "current" ? [] : [{ slice, state }] };
};

export const packageSliceProblemsOf = (
  request: SliceSource & { readonly fileText: FileTextPort; readonly roots: readonly ConfigRoot[] },
): Outcome<readonly SliceProblem[]> =>
  gatheredOutcomes({
    outcomes: request.roots
      .filter((root) => root.placement === "package")
      .map((root) => packageSliceProblem({ ...request, root })),
  });

const sliceWrite = (
  request: SliceSource & { readonly fileText: FileTextPort; readonly root: ConfigRoot },
): Outcome<readonly ProjectionWrite[]> => {
  const generated = sliceTextOf(request);
  if (generated.outcome === "failed") {
    return generated;
  }
  const written = writeProjection({
    fileText: request.fileText,
    path: request.origin.path,
    repoRoot: request.origin.repoRoot,
    file: slicePathOf(request),
    text: generated.value,
  });
  return written.outcome === "failed" ? written : { outcome: "ok", value: [written.value] };
};

const removedSlice = (request: {
  readonly fileRemoval: FileRemovalPort;
  readonly origin: SliceOrigin;
  readonly slice: RepoPath;
}): Outcome<readonly ProjectionWrite[]> => {
  const removed = request.fileRemoval.remove({
    path: request.origin.path.join({ segments: [request.origin.repoRoot, request.slice] }),
  });
  return removed.outcome === "failed"
    ? { outcome: "failed", error: { kind: "tool-failed", detail: removed.error.detail } }
    : { outcome: "ok", value: [{ path: request.slice, effect: "removed" }] };
};

const orphanWrite = (
  request: SliceSource & {
    readonly fileText: FileTextPort;
    readonly fileRemoval: FileRemovalPort;
    readonly directory: RepoPath;
  },
): Outcome<readonly ProjectionWrite[]> => {
  const root: ConfigRoot = { placement: "package", directory: request.directory };
  const slice = slicePathOf({ root });
  const regenerated = sliceTextOf({ ...request, root });
  if (regenerated.outcome === "failed") {
    return regenerated;
  }
  const current = currentProjection({
    fileText: request.fileText,
    path: request.origin.path,
    repoRoot: request.origin.repoRoot,
    file: slice,
  });
  if (current.outcome === "failed") {
    return current;
  }
  return projectionState({ current: current.value, generated: regenerated.value }) === "current"
    ? removedSlice({ fileRemoval: request.fileRemoval, origin: request.origin, slice })
    : { outcome: "ok", value: [{ path: slice, effect: "left-in-place" }] };
};

export const slicedProjectionWrites = (
  request: SliceSource & {
    readonly fileText: FileTextPort;
    readonly fileRemoval: FileRemovalPort;
    readonly roots: readonly ConfigRoot[];
    readonly trackedPaths: readonly RepoPath[];
  },
): Outcome<readonly ProjectionWrite[]> =>
  gatheredOutcomes({
    outcomes: [
      ...request.roots.map((root) => sliceWrite({ ...request, root })),
      ...orphanedSliceDirectoriesOf(request).map((directory) => orphanWrite({ ...request, directory })),
    ],
  });
