import type { CheckRequest } from "../../check/run-check.ts";
import type { CommandRequest } from "../../check/run-check-command.ts";
import type { FileTextPort } from "../../platform-ports/file-text-port.ts";
import type { RecordsSourceOf } from "../../records/records-folder.ts";
import { foundTreeExceptionsOf } from "./found-tree-exceptions.ts";
import { foundTreeGitOf } from "./found-tree-git.ts";
import { foundTreeRecordsSourceOf } from "./found-tree-records-source.ts";

export const FOUND_TREE_REVISION = "the tree the upgrade found";

export const foundTreeCheckReachOf = (request: {
  readonly check: Pick<CheckRequest, "git" | "fileText" | "path" | "exceptionRepository">;
}): Pick<CheckRequest, "baseRevision" | "git" | "exceptionRepository"> => ({
  baseRevision: FOUND_TREE_REVISION,
  git: foundTreeGitOf({ git: request.check.git, fileText: request.check.fileText, path: request.check.path }),
  exceptionRepository: foundTreeExceptionsOf({ repository: request.check.exceptionRepository }),
});

export const foundTreeRunReachOf = (request: {
  readonly recordsSourceOf: RecordsSourceOf;
  readonly command: Pick<CommandRequest, "git" | "path" | "exceptionRepositoryOf"> & { readonly fileText: Pick<FileTextPort, "read" | "exists"> };
}): { readonly baseRevision: string; readonly git: CommandRequest["git"]; readonly recordsSourceOf: RecordsSourceOf } => ({
  baseRevision: FOUND_TREE_REVISION,
  git: foundTreeGitOf({ git: request.command.git, fileText: request.command.fileText, path: request.command.path }),
  recordsSourceOf: foundTreeRecordsSourceOf({ recordsSourceOf: request.recordsSourceOf, exceptionsOf: request.command.exceptionRepositoryOf }),
});
