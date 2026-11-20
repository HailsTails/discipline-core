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

export type RemovalFailure =
  | { readonly kind: "records-file-outside-root"; readonly path: AbsolutePath; readonly root: AbsolutePath }
  | { readonly kind: "unremovable"; readonly path: AbsolutePath; readonly detail: string; readonly removed: Removed };

const PATH_SEPARATOR = /[\\/]/;

const segmentsBelowRoot = (request: { readonly ports: VersionOneRemovalPorts; readonly root: AbsolutePath; readonly file: AbsolutePath }): readonly string[] | undefined => {
  const location = request.ports.path.relative({ from: request.root, to: request.file });
  if (location.relation !== "within-root") {
    return undefined;
  }
  const segments = location.path.split(PATH_SEPARATOR).filter((segment) => segment !== "");
  return segments.length > 0 && segments.every((segment) => segment !== "..") ? segments : undefined;
};

const outsideRoot = (request: { readonly ports: VersionOneRemovalPorts; readonly removal: VersionOneRemoval }): AbsolutePath | undefined =>
  request.removal.recordsFiles.find((file) => segmentsBelowRoot({ ports: request.ports, root: request.removal.recordsRoot, file }) === undefined);

const absolutePathsOf = (request: { readonly texts: readonly string[] }): readonly AbsolutePath[] =>
  request.texts.flatMap((text) => {
    const parsed = absolutePathSchema.safeParse(text);
    return parsed.success ? [parsed.data] : [];
  });

const foldersOfFile = (request: { readonly ports: VersionOneRemovalPorts; readonly root: AbsolutePath; readonly file: AbsolutePath }): readonly AbsolutePath[] => {
  const segments = segmentsBelowRoot(request) ?? [];
  const folderSegments = segments.slice(0, -1);
  return absolutePathsOf({
    texts: [request.root, ...folderSegments.map((_, depth) => request.ports.path.join({ segments: [request.root, ...folderSegments.slice(0, depth + 1)] }))],
  });
};

const foldersToTryOf = (request: { readonly ports: VersionOneRemovalPorts; readonly removal: VersionOneRemoval }): readonly AbsolutePath[] =>
  [
    ...new Set(
      request.removal.recordsFiles.flatMap((file) => foldersOfFile({ ports: request.ports, root: request.removal.recordsRoot, file })),
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

export const removedVersionOneFiles = (request: { readonly ports: VersionOneRemovalPorts; readonly removal: VersionOneRemoval }): Result<Removed, RemovalFailure> => {
  const outside = outsideRoot(request);
  return outside === undefined
    ? removedFrom({ ports: request.ports, steps: stepsOf(request), removed: { files: [], folders: [] } })
    : { outcome: "failed", error: { kind: "records-file-outside-root", path: outside, root: request.removal.recordsRoot } };
};
