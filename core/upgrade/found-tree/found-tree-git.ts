import type { FileTextPort } from "../../platform-ports/file-text-port.ts";
import type { BaseFileText, GitContentQuery, GitPort } from "../../platform-ports/git-port.ts";
import type { PathPort } from "../../platform-ports/path-port.ts";
import type { Result } from "../../values/result.ts";

const textInTreeOf = (request: { readonly fileText: Pick<FileTextPort, "read">; readonly path: PathPort; readonly query: GitContentQuery }): BaseFileText => {
  const location = request.path.join({ segments: [request.query.repoRoot, request.query.file] });
  const read = request.fileText.read({ path: location });
  return read.outcome === "ok" ? { presence: "present-in-base", text: read.value } : { presence: "absent-from-base" };
};

export const foundTreeGitOf = (request: { readonly git: GitPort; readonly fileText: Pick<FileTextPort, "read">; readonly path: PathPort }): GitPort => ({
  trackedPaths: request.git.trackedPaths,
  changedSince: () => ({ outcome: "ok", value: [] }),
  contentInBase: (query): Result<"present-in-base" | "absent-from-base", never> => ({
    outcome: "ok",
    value: textInTreeOf({ ...request, query }).presence,
  }),
  textInBase: (query) => ({ outcome: "ok", value: textInTreeOf({ ...request, query }) }),
});
