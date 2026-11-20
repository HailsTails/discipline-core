import type { DirectoryRemovalPort } from "../../platform-ports/directory-removal-port.ts";
import type { FileRemovalPort } from "../../platform-ports/file-removal-port.ts";
import type { DirectoryPort } from "../../platform-ports/file-system-port.ts";
import type { PathPort } from "../../platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../values/absolute-path.ts";
import type { Result } from "../../values/result.ts";

export type VersionOneRemovalPorts = {
  readonly fileRemoval: FileRemovalPort;
  readonly directory: DirectoryPort;
  readonly directoryRemoval: DirectoryRemovalPort;
  readonly path: PathPort;
};

export type VersionOneRemoval = {
  readonly recordsFiles: readonly AbsolutePath[];
  readonly recordsRoot: AbsolutePath;
  readonly projection: AbsolutePath | undefined;
  readonly settings: AbsolutePath;
};

export type Removed = { readonly files: readonly AbsolutePath[]; readonly folders: readonly AbsolutePath[] };

export type RemovalFailure = { readonly kind: "unremovable"; readonly path: AbsolutePath; readonly detail: string; readonly removed: Removed };

const foldersBetween = (request: { readonly ports: VersionOneRemovalPorts; readonly path: AbsolutePath; readonly root: AbsolutePath }): readonly AbsolutePath[] => {
  const parent = absolutePathSchema.parse(request.ports.path.directoryOf({ path: request.path }));
  if (parent === request.root) {
    return [parent];
  }
  return parent === request.path ? [] : [parent, ...foldersBetween({ ports: request.ports, path: parent, root: request.root })];
};

const foldersToTryOf = (request: { readonly ports: VersionOneRemovalPorts; readonly removal: VersionOneRemoval }): readonly AbsolutePath[] =>
  [
    ...new Set(
      request.removal.recordsFiles.flatMap((file) => foldersBetween({ ports: request.ports, path: file, root: request.removal.recordsRoot })),
    ),
  ].toSorted((left, right) => right.length - left.length);

const removedFile = (request: { readonly ports: VersionOneRemovalPorts; readonly path: AbsolutePath; readonly removed: Removed }): Result<Removed, RemovalFailure> => {
  const fileRemoval = request.ports.fileRemoval.remove({ path: request.path });
  return fileRemoval.outcome === "ok"
    ? { outcome: "ok", value: { ...request.removed, files: [...request.removed.files, request.path] } }
    : { outcome: "failed", error: { kind: "unremovable", path: request.path, detail: fileRemoval.error.detail, removed: request.removed } };
};

const removedFolderIfEmpty = (request: { readonly ports: VersionOneRemovalPorts; readonly path: AbsolutePath; readonly removed: Removed }): Result<Removed, RemovalFailure> => {
  const listing = request.ports.directory.list({ path: request.path });
  if (listing.outcome === "failed") {
    return { outcome: "failed", error: { kind: "unremovable", path: request.path, detail: listing.error.detail, removed: request.removed } };
  }
  if (listing.value.length > 0) {
    return { outcome: "ok", value: request.removed };
  }
  const folderRemoval = request.ports.directoryRemoval.removeEmpty({ path: request.path });
  return folderRemoval.outcome === "ok"
    ? { outcome: "ok", value: { ...request.removed, folders: [...request.removed.folders, request.path] } }
    : { outcome: "failed", error: { kind: "unremovable", path: request.path, detail: folderRemoval.error.detail, removed: request.removed } };
};

type RemovalStep = { readonly kind: "file" | "folder-if-empty"; readonly path: AbsolutePath };

const fileStepsOf = (request: { readonly paths: readonly AbsolutePath[] }): readonly RemovalStep[] => request.paths.map((path): RemovalStep => ({ kind: "file", path }));

const stepsOf = (request: { readonly ports: VersionOneRemovalPorts; readonly removal: VersionOneRemoval }): readonly RemovalStep[] => [
  ...fileStepsOf({ paths: request.removal.recordsFiles }),
  ...foldersToTryOf(request).map((path): RemovalStep => ({ kind: "folder-if-empty", path })),
  ...fileStepsOf({ paths: request.removal.projection === undefined ? [] : [request.removal.projection] }),
  ...fileStepsOf({ paths: [request.removal.settings] }),
];

const removedFrom = (request: {
  readonly ports: VersionOneRemovalPorts;
  readonly steps: readonly RemovalStep[];
  readonly removed: Removed;
}): Result<Removed, RemovalFailure> => {
  const [step, ...rest] = request.steps;
  if (step === undefined) {
    return { outcome: "ok", value: request.removed };
  }
  const stepOutcome =
    step.kind === "file"
      ? removedFile({ ports: request.ports, path: step.path, removed: request.removed })
      : removedFolderIfEmpty({ ports: request.ports, path: step.path, removed: request.removed });
  return stepOutcome.outcome === "failed" ? stepOutcome : removedFrom({ ports: request.ports, steps: rest, removed: stepOutcome.value });
};

export const removedVersionOneFiles = (request: { readonly ports: VersionOneRemovalPorts; readonly removal: VersionOneRemoval }): Result<Removed, RemovalFailure> =>
  removedFrom({ ports: request.ports, steps: stepsOf(request), removed: { files: [], folders: [] } });
