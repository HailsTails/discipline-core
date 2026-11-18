import type { MechanismId } from "./identifiers.ts";
import type { RepoPath } from "./repo-path.ts";

export type UnprojectedFolder = {
  readonly mechanism: MechanismId;
  readonly folder: RepoPath;
};
