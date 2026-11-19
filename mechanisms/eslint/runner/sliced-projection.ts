import type { ExceptionRecord } from "../../../core/exception-records/exception-records.ts";
import type { SliceProblem } from "../../../core/mechanism-port/embedded-run-report-schema.ts";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { ProjectionWrite } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../../core/values/absolute-path.ts";
import type { ClauseAddress } from "../../../core/values/clause-address.ts";
import { gatheredOutcomes, listedOutcome } from "../../../core/values/gathered-outcomes.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { CoreInstall } from "./core-install.ts";
import type { RuleOptions } from "./eslint-piece-settings-schema.ts";
import {
  type ProjectedPiece,
  type ProjectionFiles,
  pluginImportOf,
  projectionState,
  projectionText,
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
  request: SliceSource & { readonly projectionFiles: ProjectionFiles; readonly root: ConfigRoot },
): Outcome<readonly SliceProblem[]> => {
  const slice = slicePathOf(request);
  const generated = sliceTextOf(request);
  if (generated.outcome === "failed") {
    return generated;
  }
  const current = request.projectionFiles.currentAt({ file: slice });
  if (current.outcome === "failed") {
    return current;
  }
  const state = projectionState({ current: current.value, generated: generated.value });
  return { outcome: "ok", value: state === "current" ? [] : [{ slice, state }] };
};

export const packageSliceProblemsOf = (
  request: SliceSource & { readonly projectionFiles: ProjectionFiles; readonly roots: readonly ConfigRoot[] },
): Outcome<readonly SliceProblem[]> =>
  gatheredOutcomes({
    outcomes: request.roots
      .filter((root) => root.placement === "package")
      .map((root) => packageSliceProblem({ ...request, root })),
  });

type RootPlan = { readonly file: RepoPath; readonly text: string };

type OrphanPlan = { readonly file: RepoPath; readonly decision: "remove" | "leave" };

type SlicePlan = { readonly roots: readonly RootPlan[]; readonly orphans: readonly OrphanPlan[] };

type PlanRequest = SliceSource & {
  readonly projectionFiles: ProjectionFiles;
  readonly roots: readonly ConfigRoot[];
  readonly trackedPaths: readonly RepoPath[];
};

const rootPlan = (request: SliceSource & { readonly projectionFiles: ProjectionFiles; readonly root: ConfigRoot }): Outcome<RootPlan> => {
  const generated = sliceTextOf(request);
  if (generated.outcome === "failed") {
    return generated;
  }
  const file = slicePathOf(request);
  const current = request.projectionFiles.currentAt({ file });
  return current.outcome === "failed" ? current : { outcome: "ok", value: { file, text: generated.value } };
};

const orphanPlan = (request: SliceSource & { readonly projectionFiles: ProjectionFiles; readonly directory: RepoPath }): Outcome<OrphanPlan> => {
  const root: ConfigRoot = { placement: "package", directory: request.directory };
  const file = slicePathOf({ root });
  const regenerated = sliceTextOf({ ...request, root });
  if (regenerated.outcome === "failed") {
    return regenerated;
  }
  const current = request.projectionFiles.currentAt({ file });
  if (current.outcome === "failed") {
    return current;
  }
  return {
    outcome: "ok",
    value: { file, decision: projectionState({ current: current.value, generated: regenerated.value }) === "current" ? "remove" : "leave" },
  };
};

const slicePlanOf = (request: PlanRequest): Outcome<SlicePlan> => {
  const roots = gatheredOutcomes({ outcomes: request.roots.map((root) => listedOutcome({ outcome: rootPlan({ ...request, root }) })) });
  if (roots.outcome === "failed") {
    return roots;
  }
  const orphans = gatheredOutcomes({
    outcomes: orphanedSliceDirectoriesOf(request).map((directory) => listedOutcome({ outcome: orphanPlan({ ...request, directory }) })),
  });
  return orphans.outcome === "failed" ? orphans : { outcome: "ok", value: { roots: roots.value, orphans: orphans.value } };
};

const appliedOrphan = (request: {
  readonly projectionFiles: ProjectionFiles;
  readonly orphan: OrphanPlan;
}): Outcome<ProjectionWrite> => {
  if (request.orphan.decision === "leave") {
    return { outcome: "ok", value: { path: request.orphan.file, effect: "left-in-place" } };
  }
  const removed = request.projectionFiles.removeAt({ file: request.orphan.file });
  return removed.outcome === "failed" ? removed : { outcome: "ok", value: { path: request.orphan.file, effect: "removed" } };
};

const appliedPlan = (request: {
  readonly projectionFiles: ProjectionFiles;
  readonly plan: SlicePlan;
}): Outcome<readonly ProjectionWrite[]> =>
  gatheredOutcomes({
    outcomes: [
      ...request.plan.roots.map((root) =>
        listedOutcome({
          outcome: request.projectionFiles.writeAt({ file: root.file, text: root.text }),
        }),
      ),
      ...request.plan.orphans.map((orphan) => listedOutcome({ outcome: appliedOrphan({ ...request, orphan }) })),
    ],
  });

export const slicedProjectionWrites = (request: PlanRequest): Outcome<readonly ProjectionWrite[]> => {
  const plan = slicePlanOf(request);
  return plan.outcome === "failed" ? plan : appliedPlan({ ...request, plan: plan.value });
};
