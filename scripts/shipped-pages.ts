import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { Result } from "../core/values/result.ts";
import type { ScratchFilesPort } from "./install-proof-ports.ts";
import type { ShippedPage } from "./numbered-addresses.ts";
import { LEFT_OUT_FOLDERS, ROOT_FILES, SOURCE_FOLDERS } from "./package-build.ts";

type PageSources = {
  readonly scratch: ScratchFilesPort;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly packageRoot: string;
};

type Read<Value> = Result<Value, string>;

const PAGE_SUFFIX = ".md";

const repositoryForm = (request: { readonly path: string }): string => request.path.replaceAll("\\", "/");

type PageKind = "shipped-page" | "other";

const pageKindOf = (request: { readonly path: string }): PageKind =>
  request.path.endsWith(PAGE_SUFFIX) && request.path.split("/").every((segment) => !LEFT_OUT_FOLDERS.has(segment)) ? "shipped-page" : "other";

const pagesUnder = (request: PageSources & { readonly folder: string }): Read<readonly string[]> => {
  const listed = request.scratch.listTree({ path: request.path.join({ segments: [request.packageRoot, request.folder] }) });
  if (listed.outcome === "failed") {
    return { outcome: "failed", error: `list ${request.folder}: ${listed.error.detail}` };
  }
  return {
    outcome: "ok",
    value: listed.value
      .filter((entry) => entry.entryKind === "file")
      .map((entry) => `${request.folder}/${repositoryForm({ path: entry.path })}`)
      .filter((path) => pageKindOf({ path }) === "shipped-page"),
  };
};

const presentRootPages = (request: PageSources): readonly string[] =>
  ROOT_FILES.filter(
    (name) => name.endsWith(PAGE_SUFFIX) && request.fileText.exists({ path: request.path.join({ segments: [request.packageRoot, name] }) }) === "present",
  );

const pagePaths = (request: PageSources): Read<readonly string[]> =>
  SOURCE_FOLDERS.reduce<Read<readonly string[]>>((sofar, folder) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const listed = pagesUnder({ ...request, folder });
    return listed.outcome === "failed" ? listed : { outcome: "ok", value: [...sofar.value, ...listed.value] };
  }, { outcome: "ok", value: presentRootPages(request) });

const pageAt = (request: PageSources & { readonly page: string }): Read<ShippedPage> => {
  const read = request.fileText.read({ path: request.path.join({ segments: [request.packageRoot, ...request.page.split("/")] }) });
  return read.outcome === "failed"
    ? { outcome: "failed", error: `read ${request.page}: ${read.error.detail}` }
    : { outcome: "ok", value: { path: request.page, text: read.value } };
};

export const shippedPagesAt = (request: PageSources): Read<readonly ShippedPage[]> => {
  const paths = pagePaths(request);
  if (paths.outcome === "failed") {
    return paths;
  }
  return paths.value.reduce<Read<readonly ShippedPage[]>>((sofar, page) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const read = pageAt({ ...request, page });
    return read.outcome === "failed" ? read : { outcome: "ok", value: [...sofar.value, read.value] };
  }, { outcome: "ok", value: [] });
};
