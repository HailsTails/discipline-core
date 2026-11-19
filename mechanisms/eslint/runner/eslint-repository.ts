import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { FileRemovalPort } from "../../../core/platform-ports/file-removal-port.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import type { EslintConfigLookup } from "../../../core/values/eslint-config-lookup.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import {
  type ConfigLookup,
  configLookupOf,
  type FolderConfiguration,
  folderConfigurationOf,
  teamConfigLookup,
} from "./config-lookup.ts";
import { type PackageScriptsReader, packageScriptsReaderOf } from "./package-script-scanner.ts";
import { type ProjectionFiles, projectionFilesOver } from "./projection.ts";
import { type LinesReader, linesReaderOf } from "./source-lines.ts";
import { type SuppressionsReader, suppressionsReaderOf } from "./suppressions-scanner.ts";

export type TrackedPathsRequest = { readonly trackedPaths: readonly RepoPath[] };

export type EslintRepository = {
  readonly projectionFiles: ProjectionFiles;
  readonly configLookup: (request: TrackedPathsRequest) => EslintConfigLookup;
  readonly teamConfigLookup: (request: TrackedPathsRequest) => Result<ConfigLookup, RunnerFailure>;
  readonly folderConfiguration: (request: { readonly folder: RepoPath }) => FolderConfiguration;
  readonly packageScriptsAt: PackageScriptsReader;
  readonly suppressionsAt: SuppressionsReader;
  readonly sourceLines: LinesReader;
};

export const eslintRepositoryOver = (request: {
  readonly fileText: FileTextPort;
  readonly fileRemoval: FileRemovalPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): EslintRepository => ({
  projectionFiles: projectionFilesOver(request),
  configLookup: ({ trackedPaths }) => configLookupOf({ ...request, trackedPaths }),
  teamConfigLookup: ({ trackedPaths }) => teamConfigLookup({ ...request, trackedPaths }),
  folderConfiguration: ({ folder }) => folderConfigurationOf({ ...request, folder }),
  packageScriptsAt: packageScriptsReaderOf(request),
  suppressionsAt: suppressionsReaderOf(request),
  sourceLines: linesReaderOf(request),
});
