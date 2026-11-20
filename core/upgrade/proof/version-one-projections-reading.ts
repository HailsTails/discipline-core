import type { ProjectionWrite } from "../../mechanism-port/runner-result-schema.ts";
import type { RepoPath } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import type { TeamConfigRefusal, VersionOneProjection } from "./team-config-finder.ts";

export type ChangedByVersionOne = { readonly kind: "removed" | "rewritten"; readonly path: RepoPath };

export type ProjectionsRefusal =
  | { readonly kind: "project-failed"; readonly detail: string }
  | { readonly kind: "team-config-refused"; readonly refusal: TeamConfigRefusal }
  | { readonly kind: "slice-left-in-place"; readonly files: readonly RepoPath[] };

export type VersionOneProjectionsReading = {
  readonly changed: readonly ChangedByVersionOne[];
  readonly outcome: Result<readonly VersionOneProjection[], ProjectionsRefusal>;
};

export type VersionOneProjectionsOf = () => Promise<VersionOneProjectionsReading>;

export type VersionOneProjectionSources = {
  readonly project: () => Promise<Result<readonly ProjectionWrite[], { readonly detail: string }>>;
  readonly teamConfigsOf: (request: { readonly projections: readonly RepoPath[] }) => Result<readonly VersionOneProjection[], TeamConfigRefusal>;
};

const changeOf = (request: { readonly write: ProjectionWrite }): readonly ChangedByVersionOne[] => {
  const { write } = request;
  switch (write.effect) {
    case "removed":
      return [{ kind: "removed", path: write.path }];
    case "written":
      return [{ kind: "rewritten", path: write.path }];
    case "unchanged":
    case "left-in-place":
      return [];
  }
};

const pathsWith = (request: { readonly writes: readonly ProjectionWrite[]; readonly effects: readonly ProjectionWrite["effect"][] }): readonly RepoPath[] =>
  request.writes.filter((write) => request.effects.includes(write.effect)).map((write) => write.path);

const readOver = (request: { readonly writes: readonly ProjectionWrite[]; readonly sources: VersionOneProjectionSources }): VersionOneProjectionsReading => {
  const changed = request.writes.flatMap((write) => changeOf({ write }));
  const stale = pathsWith({ writes: request.writes, effects: ["left-in-place"] });
  if (stale.length > 0) {
    return { changed, outcome: { outcome: "failed", error: { kind: "slice-left-in-place", files: stale } } };
  }
  const configs = request.sources.teamConfigsOf({ projections: pathsWith({ writes: request.writes, effects: ["unchanged", "written"] }) });
  return configs.outcome === "failed"
    ? { changed, outcome: { outcome: "failed", error: { kind: "team-config-refused", refusal: configs.error } } }
    : { changed, outcome: configs };
};

export const versionOneProjectionsOver =
  (sources: VersionOneProjectionSources): VersionOneProjectionsOf =>
  async () => {
    const written = await sources.project();
    return written.outcome === "failed"
      ? { changed: [], outcome: { outcome: "failed", error: { kind: "project-failed", detail: written.error.detail } } }
      : readOver({ writes: written.value, sources });
  };
