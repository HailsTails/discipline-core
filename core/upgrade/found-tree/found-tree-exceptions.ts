import { loadFailureDetail } from "../../command-line/load-failure-text.ts";
import type { ExceptionRepository } from "../version-one-records/exception-records.ts";

type EntriesReach = Pick<ExceptionRepository, "read" | "readAt">;

export const foundTreeExceptionsOf = (request: { readonly repository: EntriesReach }): EntriesReach => ({
  read: request.repository.read,
  readAt: () => {
    const read = request.repository.read();
    return read.outcome === "ok"
      ? { outcome: "ok", value: read.value.map(({ entry }) => entry) }
      : { outcome: "failed", error: { kind: "git-failed", command: "read the tree the upgrade found", detail: loadFailureDetail({ failure: read.error }) } };
  },
});
