import { repoPathSchema } from "../../values/repo-path.ts";
import type { ProjectionSupply } from "./run-upgrade-command.ts";

export const unwrittenProjectionSupply: ProjectionSupply = {
  versionTwoProjection: repoPathSchema.parse("hone.unwritten.mjs"),
  projectionTextOf: () => undefined,
};
