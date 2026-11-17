import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { ConfigFileSearch, EslintPort, IgnoredState, QueryInstance } from "./eslint-instance.ts";

export type GoverningConfig = { readonly configFile: string; readonly folder: AbsolutePath };

export type GoverningQueries = (request: { readonly governing: GoverningConfig }) => QueryInstance;

export type GoverningVerdict = "ignored-by-governing-config" | "not-ignored";

export type GoverningLookup = {
  readonly query: QueryInstance;
  readonly governingQueryOf: GoverningQueries;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
};

type PlacedGoverningConfig = GoverningConfig & { readonly repositoryFolder: RepoPath | "repository-root" };

const REPOSITORY_ROOT_FOLDER = ".";

export const cachedGoverningQueries = (request: { readonly eslint: EslintPort }): GoverningQueries => {
  const built = new Map<string, QueryInstance>();
  return (query) => {
    const known = built.get(query.governing.configFile);
    if (known !== undefined) {
      return known;
    }
    const created = request.eslint.createQueryInstance({
      repoRoot: query.governing.folder,
      configFile: query.governing.configFile,
    });
    built.set(query.governing.configFile, created);
    return created;
  };
};

const repositoryFolderOf = (request: { readonly folder: string }): RepoPath | "repository-root" | "outside-repository" => {
  if (request.folder === REPOSITORY_ROOT_FOLDER) {
    return "repository-root";
  }
  const parsed = repoPathSchema.safeParse(request.folder);
  return parsed.success ? parsed.data : "outside-repository";
};

const boundaryPlacement = (request: {
  readonly repositoryFolder: RepoPath | "repository-root";
  readonly boundary: RepoPath;
}): "above-boundary" | "not-above-boundary" =>
  request.repositoryFolder === "repository-root" || request.boundary.startsWith(`${request.repositoryFolder}/`)
    ? "above-boundary"
    : "not-above-boundary";

const placedGoverningConfig = (request: {
  readonly lookup: GoverningLookup;
  readonly search: ConfigFileSearch;
  readonly boundary: RepoPath;
}): PlacedGoverningConfig | undefined => {
  if (request.search.kind !== "found") {
    return undefined;
  }
  const placed = request.lookup.path.relative({ from: request.lookup.repoRoot, to: request.search.path });
  if (placed.relation === "different-root") {
    return undefined;
  }
  const repositoryFolder = repositoryFolderOf({ folder: request.lookup.path.repositoryDirectoryOf({ path: placed.path }) });
  const folder = request.lookup.path.resolve({ path: request.lookup.path.directoryOf({ path: request.search.path }) });
  if (repositoryFolder === "outside-repository" || folder.outcome === "failed") {
    return undefined;
  }
  return boundaryPlacement({ repositoryFolder, boundary: request.boundary }) === "above-boundary"
    ? { configFile: request.search.path, folder: folder.value, repositoryFolder }
    : undefined;
};

const probeOf = (request: {
  readonly lookup: GoverningLookup;
  readonly governing: GoverningConfig;
  readonly boundary: RepoPath;
  readonly fileName: string;
}): RepoPath | undefined => {
  const probe = request.lookup.path.relative({
    from: request.governing.folder,
    to: request.lookup.path.join({ segments: [request.lookup.repoRoot, request.boundary, request.fileName] }),
  });
  if (probe.relation === "different-root") {
    return undefined;
  }
  const parsed = repoPathSchema.safeParse(probe.path);
  return parsed.success ? parsed.data : undefined;
};

const answeredIgnore = (request: { readonly state: Result<IgnoredState, RunnerFailure> }): IgnoredState | "unanswered" =>
  request.state.outcome === "ok" ? request.state.value : "unanswered";

const verdictAbove = (request: {
  readonly lookup: GoverningLookup;
  readonly governing: PlacedGoverningConfig;
  readonly fileName: string;
}): Promise<GoverningVerdict> =>
  request.governing.repositoryFolder === "repository-root"
    ? Promise.resolve("not-ignored")
    : governingVerdict({ lookup: request.lookup, boundary: request.governing.repositoryFolder, fileName: request.fileName });

const verdictOfGoverning = (request: {
  readonly lookup: GoverningLookup;
  readonly governing: PlacedGoverningConfig;
  readonly boundary: RepoPath;
  readonly fileName: string;
}): Promise<GoverningVerdict> => {
  const probe = probeOf(request);
  if (probe === undefined) {
    return Promise.resolve("not-ignored");
  }
  return request.lookup
    .governingQueryOf({ governing: { configFile: request.governing.configFile, folder: request.governing.folder } })
    .ignoredState({ file: probe })
    .then((state): GoverningVerdict | Promise<GoverningVerdict> =>
      answeredIgnore({ state }) === "ignored" ? "ignored-by-governing-config" : verdictAbove(request),
    );
};

const governingVerdict = (request: {
  readonly lookup: GoverningLookup;
  readonly boundary: RepoPath;
  readonly fileName: string;
}): Promise<GoverningVerdict> =>
  request.lookup.query.configFileOf({ file: request.boundary }).then((search): GoverningVerdict | Promise<GoverningVerdict> => {
    const governing = placedGoverningConfig({ lookup: request.lookup, search, boundary: request.boundary });
    return governing === undefined ? "not-ignored" : verdictOfGoverning({ ...request, governing });
  });

export const brokenConfigVerdict = (request: {
  readonly lookup: GoverningLookup;
  readonly brokenConfig: string;
  readonly file: RepoPath;
}): Promise<GoverningVerdict> => {
  const placed = request.lookup.path.relative({ from: request.lookup.repoRoot, to: request.brokenConfig });
  if (placed.relation === "different-root") {
    return Promise.resolve("not-ignored");
  }
  const boundary = repositoryFolderOf({ folder: request.lookup.path.repositoryDirectoryOf({ path: placed.path }) });
  if (boundary === "repository-root" || boundary === "outside-repository") {
    return Promise.resolve("not-ignored");
  }
  const fileName = request.lookup.path.relative({
    from: request.lookup.path.repositoryDirectoryOf({ path: request.file }),
    to: request.file,
  });
  return fileName.relation === "different-root"
    ? Promise.resolve("not-ignored")
    : governingVerdict({ lookup: request.lookup, boundary, fileName: fileName.path });
};
