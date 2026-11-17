import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import { CONFIG_FILE_NAMES } from "./config-lookup.ts";
import type { EslintPort, QueryInstance } from "./eslint-instance.ts";

export type RootIgnorePorts = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly eslint: EslintPort;
};

type IgnoreRequest = {
  readonly ports: RootIgnorePorts;
  readonly repoRoot: AbsolutePath;
  readonly packages: ReadonlySet<string>;
};

type GoverningQueries = (request: { readonly folder: string }) => QueryInstance | undefined;

type RootVerdict = "ignored" | "loaded";

const REPOSITORY_FOLDER = "";

const configNameIn = (request: IgnoreRequest & { readonly folder: string }): string | undefined =>
  CONFIG_FILE_NAMES.find(
    (name) =>
      request.ports.fileText.exists({
        path: request.ports.path.join({ segments: [request.repoRoot, request.folder, name] }),
      }) === "present",
  );

const governingQueryOf = (request: IgnoreRequest & { readonly folder: string }): QueryInstance | undefined => {
  const configName = configNameIn(request);
  const folder = request.ports.path.resolve({ path: request.ports.path.join({ segments: [request.repoRoot, request.folder] }) });
  return configName === undefined || folder.outcome === "failed"
    ? undefined
    : request.ports.eslint.createQueryInstance({
        repoRoot: folder.value,
        configFile: request.ports.path.join({ segments: [folder.value, configName] }),
      });
};

const cachedGoverningQueries = (request: IgnoreRequest): GoverningQueries => {
  const built = new Map<string, QueryInstance | undefined>();
  return (query) => {
    if (built.has(query.folder)) {
      return built.get(query.folder);
    }
    const created = governingQueryOf({ ...request, folder: query.folder });
    built.set(query.folder, created);
    return created;
  };
};

const governingFoldersOf = (request: { readonly directory: RepoPath; readonly packages: ReadonlySet<string> }): readonly string[] => {
  const folders = request.directory.split("/").slice(0, -1);
  return [
    REPOSITORY_FOLDER,
    ...folders.map((_, index) => folders.slice(0, index + 1).join("/")).filter((folder) => request.packages.has(folder)),
  ];
};

const probeOf = (request: { readonly directory: RepoPath; readonly folder: string; readonly configName: string }): RepoPath =>
  repoPathSchema.parse(
    `${request.folder === REPOSITORY_FOLDER ? request.directory : request.directory.slice(request.folder.length + 1)}/${request.configName}`,
  );

const verdictOf = (request: { readonly query: QueryInstance | undefined; readonly probe: RepoPath }): Promise<RootVerdict> =>
  request.query === undefined
    ? Promise.resolve("loaded")
    : request.query
        .ignoredState({ file: request.probe })
        .then((state): RootVerdict => (state.outcome === "ok" && state.value === "ignored" ? "ignored" : "loaded"));

const rootVerdict = (
  request: IgnoreRequest & { readonly directory: RepoPath; readonly queries: GoverningQueries },
): Promise<RootVerdict> => {
  const configName = configNameIn({ ...request, folder: request.directory });
  if (configName === undefined) {
    return Promise.resolve("loaded");
  }
  return Promise.all(
    governingFoldersOf(request).map((folder) =>
      verdictOf({ query: request.queries({ folder }), probe: probeOf({ directory: request.directory, folder, configName }) }),
    ),
  ).then((verdicts): RootVerdict => (verdicts.includes("ignored") ? "ignored" : "loaded"));
};

export const ignoredRootsOf = (
  request: IgnoreRequest & { readonly candidates: readonly RepoPath[] },
): Promise<ReadonlySet<string>> => {
  const queries = cachedGoverningQueries(request);
  return Promise.all(
    request.candidates.map((directory) =>
      rootVerdict({ ...request, directory, queries }).then((verdict) => (verdict === "ignored" ? [directory] : [])),
    ),
  ).then((ignored) => new Set(ignored.flat()));
};
