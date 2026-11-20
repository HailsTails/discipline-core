import type { GitPort } from "../platform-ports/git-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { ForfeitureAssessment } from "../values/assessment.ts";
import { computeTouchedSet, type TouchedSet } from "./touched-set.ts";

export const touchedSetUnder = (request: {
  readonly forfeiture: ForfeitureAssessment;
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: Pick<GitPort, "changedSince">;
}): TouchedSet => (request.forfeiture === "elsewhere" ? { measured: "elsewhere" } : computeTouchedSet(request));
