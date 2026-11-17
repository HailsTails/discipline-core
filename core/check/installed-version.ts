import { z } from "zod";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { Result } from "../values/result.ts";
import { parsedJson } from "../rule-set-reader/rule-set-reader.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "./load-failure.ts";

const PACKAGE_MANIFEST = "package.json";

const versionedManifestSchema = z.looseObject({ version: z.string() });

const versionIn = (request: { readonly path: string; readonly text: string }): Result<string, LoadFailure> => {
  const json = parsedJson(request);
  const manifest = versionedManifestSchema.safeParse(json.outcome === "ok" ? json.value : undefined);
  return manifest.success
    ? { outcome: "ok", value: manifest.data.version }
    : { outcome: "failed", error: { kind: "file-malformed", path: request.path, detail: `${PACKAGE_MANIFEST} holds no version` } };
};

export const installedVersionOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly moduleUrl: string;
}): Result<string, LoadFailure> => {
  const installRoot = installRootOf(request);
  if (installRoot.outcome === "failed") {
    return installRoot;
  }
  const manifestPath = request.path.join({ segments: [installRoot.value, PACKAGE_MANIFEST] });
  const text = request.fileText.read({ path: manifestPath });
  return text.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-unreadable", path: manifestPath, detail: text.error.detail } }
    : versionIn({ path: manifestPath, text: text.value });
};
