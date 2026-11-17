import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { TOOL_IDENTITY } from "../values/tool-identity.ts";

export type PackageLink =
  | { readonly kind: "linked"; readonly installRoot: AbsolutePath; readonly linkRoot: string }
  | { readonly kind: "unlinked" };

export const UNLINKED: PackageLink = { kind: "unlinked" };

const INSTALL_FOLDER = "node_modules";

const PACKAGE_MANIFEST = "package.json";

type LinkRequest = {
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
};

const manifestTextAt = (request: LinkRequest & { readonly root: string }): string | undefined => {
  const read = request.fileText.read({ path: request.path.join({ segments: [request.root, PACKAGE_MANIFEST] }) });
  return read.outcome === "ok" ? read.value : undefined;
};

const sameFolder = (request: { readonly path: PathPort; readonly from: string; readonly to: string }): "same" | "different" => {
  const location = request.path.relative(request);
  return location.relation === "within-root" && location.path === "" ? "same" : "different";
};

const holdsRunningPackage = (request: LinkRequest & { readonly linkRoot: string }): "holds" | "does-not-hold" => {
  const running = manifestTextAt({ ...request, root: request.installRoot });
  return running !== undefined && running === manifestTextAt({ ...request, root: request.linkRoot }) ? "holds" : "does-not-hold";
};

export const packageLinkOf = (request: LinkRequest): PackageLink => {
  const linkRoot = request.path.join({ segments: [request.repoRoot, INSTALL_FOLDER, TOOL_IDENTITY.packageName] });
  const linked: PackageLink = { kind: "linked", installRoot: request.installRoot, linkRoot };
  if (sameFolder({ path: request.path, from: linkRoot, to: request.installRoot }) === "same") {
    return linked;
  }
  return holdsRunningPackage({ ...request, linkRoot }) === "holds" ? linked : UNLINKED;
};
