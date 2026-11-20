import type { SelectionRepository } from "../../consumer-selection/consumer-selection.ts";
import { readSelectionFile, selectionFilePathOf } from "../../consumer-selection/selection-reader.ts";
import type { LoadFailure } from "../../command-line/load-failure.ts";
import type { FileTextPort } from "../../platform-ports/file-text-port.ts";
import type { PathPort } from "../../platform-ports/path-port.ts";
import type { AbsolutePath } from "../../values/absolute-path.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import type { Result } from "../../values/result.ts";
import { type HeadRecordsRefusal, headRecordsOf } from "../version-one-head/head-records.ts";
import { type ExceptionRepository, UNMEASURED_EXCEPTION_BASELINE } from "../version-one-records/exception-records.ts";
import type { VersionOneReading } from "../proof/upgrade-plan.ts";
import type { VersionOneFiles } from "../proof/upgrade-proof.ts";
import type { RecordsOnDisk } from "./version-one-records-on-disk.ts";

const VERSION_ONE_SETTINGS = repoPathSchema.parse("disciplines.json");

export type VersionOneRead = { readonly reading: VersionOneReading; readonly versionOneFiles: VersionOneFiles };

export type VersionOneReadFailure =
  | { readonly kind: "version-one-unreadable"; readonly failure: LoadFailure }
  | { readonly kind: "records-refused"; readonly refusal: HeadRecordsRefusal };

export type VersionOneReadRequest = {
  readonly repoRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly selectionRepository: SelectionRepository;
  readonly exceptionRepository: Pick<ExceptionRepository, "read">;
  readonly recordsOnDisk: RecordsOnDisk;
};

export const versionOneReadOf = (request: VersionOneReadRequest): Result<VersionOneRead, VersionOneReadFailure> => {
  const unreadable = (failure: LoadFailure): Result<never, VersionOneReadFailure> => ({ outcome: "failed", error: { kind: "version-one-unreadable", failure } });
  const file = readSelectionFile({ fileText: request.fileText, path: selectionFilePathOf({ path: request.path, repoRoot: request.repoRoot }) });
  if (file.outcome === "failed") {
    return unreadable(file.error);
  }
  const selected = request.selectionRepository.read({});
  if (selected.outcome === "failed") {
    return unreadable(selected.error);
  }
  const entries = request.exceptionRepository.read();
  if (entries.outcome === "failed") {
    return unreadable(entries.error);
  }
  const heads = headRecordsOf({
    entries: entries.value,
    selection: selected.value.selection,
    fileExceptionWhyChains: selected.value.fileExceptionWhyChains,
    baseline: UNMEASURED_EXCEPTION_BASELINE,
  });
  if (heads.outcome === "failed") {
    return { outcome: "failed", error: { kind: "records-refused", refusal: heads.error } };
  }
  return {
    outcome: "ok",
    value: {
      reading: { selection: file.value, heads: heads.value },
      versionOneFiles: {
        recordsFiles: request.recordsOnDisk.files,
        recordsFolders: request.recordsOnDisk.folders,
        recordsRoot: request.recordsOnDisk.root,
        settings: VERSION_ONE_SETTINGS,
      },
    },
  };
};
