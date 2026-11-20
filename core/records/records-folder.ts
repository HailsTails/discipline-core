import type { DirectoryEntry, DirectoryPort } from "../platform-ports/file-system-port.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitFailure, GitPort, GitTreePort } from "../platform-ports/git-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../values/absolute-path.ts";
import { parsedJson } from "../values/parsed-json.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import type { RecordsDocument } from "./hone-record.ts";
import { RECORDS_FOLDER, recordsFileStandingOf } from "./records-layout.ts";

export type RecordsFolderFailure =
  | { readonly kind: "records-folder-unreadable"; readonly folder: RepoPath; readonly detail: string }
  | { readonly kind: "records-file-unreadable"; readonly file: RepoPath; readonly detail: string }
  | { readonly kind: "records-file-not-json"; readonly file: RepoPath; readonly detail: string }
  | { readonly kind: "not-a-records-file"; readonly file: RepoPath }
  | GitFailure;

export type RecordsSource = {
  readonly read: () => Result<readonly RecordsDocument[], RecordsFolderFailure>;
  readonly readAt: (request: { readonly revision: string }) => Result<readonly RecordsDocument[], RecordsFolderFailure>;
};

export type RecordsFolderPorts = {
  readonly fileText: Pick<FileTextPort, "exists" | "read">;
  readonly path: Pick<PathPort, "join">;
  readonly directory: Pick<DirectoryPort, "list">;
  readonly git: Pick<GitPort, "textInBase">;
  readonly gitTree: GitTreePort;
};

type FolderRequest = RecordsFolderPorts & { readonly repoRoot: AbsolutePath };

type Listed = Result<readonly RepoPath[], RecordsFolderFailure>;

const RECORDS_FOLDER_PATH = repoPathSchema.parse(RECORDS_FOLDER);

const absoluteOf = (request: FolderRequest & { readonly file: RepoPath }): AbsolutePath =>
  absolutePathSchema.parse(request.path.join({ segments: [request.repoRoot, request.file] }));

const childOf = (request: { readonly folder: RepoPath; readonly entry: DirectoryEntry }): RepoPath => repoPathSchema.parse(`${request.folder}/${request.entry.name}`);

const inPathOrder = (request: { readonly files: readonly RepoPath[] }): readonly RepoPath[] =>
  request.files.toSorted((left, right) => left.localeCompare(right, "en"));

const joined = (request: { readonly listings: readonly Listed[] }): Listed => {
  const failure = request.listings.find((listing) => listing.outcome === "failed");
  return failure ?? { outcome: "ok", value: request.listings.flatMap((listing) => (listing.outcome === "ok" ? listing.value : [])) };
};

const entriesIn = (request: FolderRequest & { readonly folder: RepoPath }): Result<readonly DirectoryEntry[], RecordsFolderFailure> => {
  const listed = request.directory.list({ path: absoluteOf({ ...request, file: request.folder }) });
  return listed.outcome === "failed" ? { outcome: "failed", error: { kind: "records-folder-unreadable", folder: request.folder, detail: listed.error.detail } } : listed;
};

const kindFolderFiles = (request: FolderRequest & { readonly folder: RepoPath }): Listed => {
  const entries = entriesIn(request);
  if (entries.outcome === "failed") {
    return entries;
  }
  const directory = entries.value.find((entry) => entry.kind === "directory");
  return directory === undefined
    ? { outcome: "ok", value: entries.value.map((entry) => childOf({ folder: request.folder, entry })) }
    : { outcome: "failed", error: { kind: "not-a-records-file", file: childOf({ folder: request.folder, entry: directory }) } };
};

const recordsFolderFiles = (request: FolderRequest): Listed => {
  const entries = entriesIn({ ...request, folder: RECORDS_FOLDER_PATH });
  if (entries.outcome === "failed") {
    return entries;
  }
  return joined({
    listings: entries.value.map((entry) => {
      const child = childOf({ folder: RECORDS_FOLDER_PATH, entry });
      return entry.kind === "directory" ? kindFolderFiles({ ...request, folder: child }) : { outcome: "ok", value: [child] };
    }),
  });
};

const documentOfText = (request: { readonly file: RepoPath; readonly text: string }): Result<RecordsDocument, RecordsFolderFailure> => {
  const parsed = parsedJson({ text: request.text });
  return parsed.outcome === "failed"
    ? { outcome: "failed", error: { kind: "records-file-not-json", file: request.file, detail: parsed.error } }
    : { outcome: "ok", value: { file: request.file, document: parsed.value } };
};

type Documents = Result<readonly RecordsDocument[], RecordsFolderFailure>;

const documentsOf = (request: { readonly files: readonly RepoPath[]; readonly documentsAt: (file: RepoPath) => Documents }): Documents =>
  request.files.reduce<Documents>((sofar, file) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const documents = request.documentsAt(file);
    return documents.outcome === "failed" ? documents : { outcome: "ok", value: [...sofar.value, ...documents.value] };
  }, { outcome: "ok", value: [] });

const listedDocument = (request: { readonly file: RepoPath; readonly text: string }): Documents => {
  const document = documentOfText(request);
  return document.outcome === "failed" ? document : { outcome: "ok", value: [document.value] };
};

const workingDocumentsAt = (request: FolderRequest & { readonly file: RepoPath }): Documents => {
  if (recordsFileStandingOf({ file: request.file }).standing === "not-a-records-file") {
    return { outcome: "failed", error: { kind: "not-a-records-file", file: request.file } };
  }
  const text = request.fileText.read({ path: absoluteOf(request) });
  return text.outcome === "failed"
    ? { outcome: "failed", error: { kind: "records-file-unreadable", file: request.file, detail: text.error.detail } }
    : listedDocument({ file: request.file, text: text.value });
};

const workingDocuments = (request: FolderRequest): Result<readonly RecordsDocument[], RecordsFolderFailure> => {
  if (request.fileText.exists({ path: absoluteOf({ ...request, file: RECORDS_FOLDER_PATH }) }) === "absent") {
    return { outcome: "ok", value: [] };
  }
  const files = recordsFolderFiles(request);
  return files.outcome === "failed"
    ? files
    : documentsOf({ files: inPathOrder({ files: files.value }), documentsAt: (file) => workingDocumentsAt({ ...request, file }) });
};

const baseDocumentsAt = (request: FolderRequest & { readonly revision: string; readonly file: RepoPath }): Documents => {
  const text = request.git.textInBase({ repoRoot: request.repoRoot, baseRevision: request.revision, file: request.file });
  if (text.outcome === "failed") {
    return text;
  }
  return text.value.presence === "present-in-base" ? listedDocument({ file: request.file, text: text.value.text }) : { outcome: "ok", value: [] };
};

const baseDocuments = (request: FolderRequest & { readonly revision: string }): Result<readonly RecordsDocument[], RecordsFolderFailure> => {
  const paths = request.gitTree.pathsAt({ repoRoot: request.repoRoot, revision: request.revision });
  if (paths.outcome === "failed") {
    return paths;
  }
  const files = paths.value.filter((file) => recordsFileStandingOf({ file }).standing !== "not-a-records-file");
  return documentsOf({ files: inPathOrder({ files }), documentsAt: (file) => baseDocumentsAt({ ...request, file }) });
};

export const createRecordsFolder = (request: FolderRequest): RecordsSource => ({
  read: () => workingDocuments(request),
  readAt: (at) => baseDocuments({ ...request, revision: at.revision }),
});
