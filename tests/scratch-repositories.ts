import type { FileTextPort } from "../core/platform-ports/file-system-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../core/values/absolute-path.ts";
import type { ScratchFilesPort } from "../scripts/install-proof-ports.ts";

export type ScratchRepositories = {
  readonly repositoryWith: (request: { readonly files: Readonly<Record<string, string>> }) => AbsolutePath;
  readonly removeAll: () => void;
};

export const scratchRepositoriesUnder = (request: {
  readonly parent: string;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
}): ScratchRepositories => {
  const made: AbsolutePath[] = [];
  return {
    repositoryWith: (repository) => {
      const folder = absolutePathSchema.parse(`${request.parent.replaceAll("\\", "/")}/scratch-${globalThis.crypto.randomUUID()}`);
      const directory = request.scratch.makeDirectory({ path: folder });
      if (directory.outcome !== "ok") {
        throw new Error(`a scratch folder could not be made at ${folder}: ${directory.error.detail}`);
      }
      made.push(folder);
      Object.entries(repository.files).forEach(([name, text]) => {
        request.fileText.write({ path: `${folder}/${name}`, text });
      });
      return folder;
    },
    removeAll: () => {
      made.forEach((folder) => {
        request.scratch.removeTree({ path: folder });
      });
    },
  };
};
