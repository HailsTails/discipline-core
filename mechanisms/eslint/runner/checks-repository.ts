import type { FileRemovalPort } from "../../../core/platform-ports/file-removal-port.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import { type PackageScriptsReader, packageScriptsReaderOf } from "./package-script-scanner.ts";
import { type ProjectionFiles, projectionFilesOver } from "./projection.ts";
import { type LinesReader, linesReaderOf } from "./source-lines.ts";
import { type SuppressionsReader, suppressionsReaderOf } from "./suppressions-scanner.ts";

export type ChecksRepository = {
  readonly projectionFiles: ProjectionFiles;
  readonly packageScriptsAt: PackageScriptsReader;
  readonly suppressionsAt: SuppressionsReader;
  readonly sourceLines: LinesReader;
};

export const checksRepositoryOver = (request: {
  readonly fileText: FileTextPort;
  readonly fileRemoval: FileRemovalPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): ChecksRepository => ({
  projectionFiles: projectionFilesOver(request),
  packageScriptsAt: packageScriptsReaderOf(request),
  suppressionsAt: suppressionsReaderOf(request),
  sourceLines: linesReaderOf(request),
});
