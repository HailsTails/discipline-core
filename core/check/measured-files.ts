import type { MeasuredFiles } from "../exception-records/paid-debt.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { MechanismRun } from "./mechanism-dispatch.ts";

type MeasuringRun = Pick<MechanismRun, "mechanism" | "projection" | "slices" | "unprojectedFolders">;

const REPOSITORY_FOLDER = "";

const sliceFolderOf = (request: { readonly slice: RepoPath }): string => request.slice.split("/").slice(0, -1).join("/");

const unmeasuredFoldersOf = (request: { readonly run: MeasuringRun }): readonly string[] => [
  ...request.run.slices.map((slice) => sliceFolderOf({ slice: slice.slice })),
  ...request.run.unprojectedFolders.map((unprojected) => unprojected.folder),
];

const insideFolder = (request: { readonly file: RepoPath; readonly folder: string }): "inside" | "outside" =>
  request.folder === REPOSITORY_FOLDER || request.file.startsWith(`${request.folder}/`) ? "inside" : "outside";

const projectionHeld = (request: { readonly run: MeasuringRun }): "held" | "not-held" =>
  request.run.projection === "none" || request.run.projection === "current" ? "held" : "not-held";

export const measuredFilesOf = (request: { readonly run: MeasuringRun; readonly checkedFiles: readonly RepoPath[] }): MeasuredFiles => {
  if (projectionHeld(request) === "not-held") {
    return { mechanism: request.run.mechanism, files: [] };
  }
  const unmeasuredFolders = unmeasuredFoldersOf(request);
  return {
    mechanism: request.run.mechanism,
    files: request.checkedFiles.filter((file) => unmeasuredFolders.every((folder) => insideFolder({ file, folder }) === "outside")),
  };
};
