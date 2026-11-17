import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { ConfigLookup } from "./config-lookup.ts";
import type { EslintPort } from "./eslint-instance.ts";
import { cachedGoverningIgnores, type GoverningLookup, ignoredFolderVerdict } from "./governing-config.ts";

export type RootIgnoreRequest = {
  readonly eslint: EslintPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly lookup: ConfigLookup;
  readonly candidates: readonly RepoPath[];
};

const governingLookupOf = (request: RootIgnoreRequest): GoverningLookup => ({
  query: request.eslint.createQueryInstance(
    request.lookup.kind === "repository-root"
      ? { repoRoot: request.repoRoot, configFile: request.lookup.configFile }
      : { repoRoot: request.repoRoot },
  ),
  governingIgnoreOf: cachedGoverningIgnores({ eslint: request.eslint }),
  path: request.path,
  repoRoot: request.repoRoot,
});

export const ignoredRootsOf = (request: RootIgnoreRequest): Promise<ReadonlySet<string>> => {
  if (request.candidates.length === 0) {
    return Promise.resolve(new Set());
  }
  const lookup = governingLookupOf(request);
  return Promise.all(
    request.candidates.map((folder) =>
      ignoredFolderVerdict({ lookup, folder }).then((verdict) => (verdict === "ignored-by-governing-config" ? [folder] : [])),
    ),
  ).then((ignored) => new Set(ignored.flat()));
};
