import { z } from "zod";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitFailure, GitHistoryPort } from "../core/platform-ports/git-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import type { Result } from "../core/values/result.ts";
import { CHANGELOG_FILE, changelogSectionOf, changelogWithSection } from "./changelog.ts";
import { type ChangeEntry, changeEntryOf } from "./conventional-subject.ts";
import { packageVersionOf } from "./published-manifest.ts";
import {
  channelOf,
  latestReleaseOf,
  nextVersionOf,
  RELEASE_TAG_PREFIX,
  type Release,
  type ReleaseChannel,
  type ReleaseSize,
  releaseSizeOf,
  versionText,
} from "./release-version.ts";

export type ReleasePullRequestPorts = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly history: GitHistoryPort;
  readonly moduleUrl: string;
};

type Prepared<Value> = Result<Value, string>;

type PreparedFile = { readonly path: string; readonly text: string };

type RepositoryFiles = {
  readonly changelog: PreparedFile;
  readonly manifest: PreparedFile;
};

type MergedHistory = { readonly release: Release; readonly entries: readonly ChangeEntry[] };

type NextRelease = {
  readonly from: Release;
  readonly version: string;
  readonly size: ReleaseSize;
  readonly channel: ReleaseChannel;
  readonly entries: readonly ChangeEntry[];
};

type PreparedRelease = NextRelease & { readonly files: readonly PreparedFile[] };

const COMMAND = "release-pull-request";

const USAGE = `usage: ${COMMAND} [pre-release|stable]\n`;

const MANIFEST_FILE = "package.json";

const channelArgumentsSchema = z.union([z.tuple([]), z.tuple([z.enum(["pre-release", "stable"])])]);

const gitFailureText = (request: { readonly failure: GitFailure }): string => `${request.failure.command} failed: ${request.failure.detail}`;

const repositoryRootOf = (request: ReleasePullRequestPorts): Prepared<AbsolutePath> => {
  const script = request.path.fromFileUrl({ url: request.moduleUrl });
  if (script.outcome === "failed") {
    return { outcome: "failed", error: `cannot locate the repository: ${script.error.detail}` };
  }
  const root = request.path.resolve({ path: request.path.directoryOf({ path: request.path.directoryOf({ path: script.value }) }) });
  return root.outcome === "failed" ? { outcome: "failed", error: `cannot resolve the repository root ${root.error.path}` } : root;
};

const fileAt = (request: { readonly fileText: FileTextPort; readonly path: string }): Prepared<PreparedFile> => {
  const read = request.fileText.read({ path: request.path });
  return read.outcome === "failed"
    ? { outcome: "failed", error: `cannot read ${read.error.path}: ${read.error.detail}` }
    : { outcome: "ok", value: { path: request.path, text: read.value } };
};

const repositoryFilesOf = (request: ReleasePullRequestPorts & { readonly repoRoot: AbsolutePath }): Prepared<RepositoryFiles> => {
  const manifest = fileAt({ fileText: request.fileText, path: request.path.join({ segments: [request.repoRoot, MANIFEST_FILE] }) });
  if (manifest.outcome === "failed") {
    return manifest;
  }
  const changelog = fileAt({ fileText: request.fileText, path: request.path.join({ segments: [request.repoRoot, CHANGELOG_FILE] }) });
  return changelog.outcome === "failed" ? changelog : { outcome: "ok", value: { changelog: changelog.value, manifest: manifest.value } };
};

const mergedHistoryOf = (request: { readonly history: GitHistoryPort; readonly repoRoot: AbsolutePath }): Prepared<MergedHistory> => {
  const tags = request.history.mergedTags({ repoRoot: request.repoRoot, pattern: `${RELEASE_TAG_PREFIX}*` });
  if (tags.outcome === "failed") {
    return { outcome: "failed", error: gitFailureText({ failure: tags.error }) };
  }
  const release = latestReleaseOf({ tags: tags.value });
  if (release.outcome === "failed") {
    return release;
  }
  const subjects = request.history.subjectsAfter({ repoRoot: request.repoRoot, revision: release.value.tag });
  return subjects.outcome === "failed"
    ? { outcome: "failed", error: gitFailureText({ failure: subjects.error }) }
    : { outcome: "ok", value: { release: release.value, entries: subjects.value.map((subject) => changeEntryOf({ subject })) } };
};

const nextReleaseOf = (request: { readonly history: MergedHistory; readonly requestedChannel: ReleaseChannel | undefined }): Prepared<NextRelease> => {
  const { release, entries } = request.history;
  const size = releaseSizeOf({ entries });
  if (size === "nothing") {
    return { outcome: "failed", error: `nothing is merged since ${release.tag}, so there is nothing to release.` };
  }
  const channel = request.requestedChannel ?? channelOf({ version: release.version });
  const version = versionText({ version: nextVersionOf({ current: release.version, size, channel }) });
  return { outcome: "ok", value: { from: release, version, size, channel, entries } };
};

const releasedManifestVersionOf = (request: { readonly manifest: string; readonly release: Release }): Prepared<string> => {
  const manifestVersion = packageVersionOf({ developmentManifest: request.manifest });
  if (manifestVersion.outcome === "failed") {
    return { outcome: "failed", error: `${MANIFEST_FILE} has no readable version: ${manifestVersion.error.detail}` };
  }
  const releasedVersion = versionText({ version: request.release.version });
  return manifestVersion.value === releasedVersion
    ? { outcome: "ok", value: releasedVersion }
    : {
        outcome: "failed",
        error: `${MANIFEST_FILE} is at ${manifestVersion.value}, not ${request.release.tag}'s ${releasedVersion}, so a release is already prepared or the tag is missing.`,
      };
};

const manifestWithVersion = (request: { readonly manifest: string; readonly from: string; readonly to: string }): Prepared<string> => {
  const field = `"version": ${JSON.stringify(request.from)}`;
  const pieces = request.manifest.split(field);
  return pieces.length === 2
    ? { outcome: "ok", value: pieces.join(`"version": ${JSON.stringify(request.to)}`) }
    : { outcome: "failed", error: `${MANIFEST_FILE} does not hold ${field} exactly once` };
};

const updatedFilesOf = (request: { readonly next: NextRelease; readonly files: RepositoryFiles }): Prepared<readonly PreparedFile[]> => {
  const releasedVersion = releasedManifestVersionOf({ manifest: request.files.manifest.text, release: request.next.from });
  if (releasedVersion.outcome === "failed") {
    return releasedVersion;
  }
  const changelog = changelogWithSection({
    changelog: request.files.changelog.text,
    version: request.next.version,
    section: changelogSectionOf({ version: request.next.version, entries: request.next.entries }),
  });
  if (changelog.outcome === "failed") {
    return changelog;
  }
  const manifest = manifestWithVersion({ manifest: request.files.manifest.text, from: releasedVersion.value, to: request.next.version });
  return manifest.outcome === "failed"
    ? manifest
    : {
        outcome: "ok",
        value: [
          { path: request.files.changelog.path, text: changelog.value },
          { path: request.files.manifest.path, text: manifest.value },
        ],
      };
};

const preparedRelease = (request: ReleasePullRequestPorts & { readonly requestedChannel: ReleaseChannel | undefined }): Prepared<PreparedRelease> => {
  const repoRoot = repositoryRootOf(request);
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  const history = mergedHistoryOf({ history: request.history, repoRoot: repoRoot.value });
  if (history.outcome === "failed") {
    return history;
  }
  const next = nextReleaseOf({ history: history.value, requestedChannel: request.requestedChannel });
  if (next.outcome === "failed") {
    return next;
  }
  const files = repositoryFilesOf({ ...request, repoRoot: repoRoot.value });
  if (files.outcome === "failed") {
    return files;
  }
  const updated = updatedFilesOf({ next: next.value, files: files.value });
  return updated.outcome === "failed" ? updated : { outcome: "ok", value: { ...next.value, files: updated.value } };
};

const writtenFiles = (request: { readonly fileText: FileTextPort; readonly files: readonly PreparedFile[] }): Prepared<null> =>
  request.files.reduce<Prepared<null>>((soFar, file) => {
    if (soFar.outcome === "failed") {
      return soFar;
    }
    const written = request.fileText.write(file);
    return written.outcome === "failed" ? { outcome: "failed", error: `cannot write ${written.error.path}: ${written.error.detail}` } : soFar;
  }, { outcome: "ok", value: null });

const summaryOf = (request: { readonly prepared: PreparedRelease }): string =>
  `${COMMAND}: ${versionText({ version: request.prepared.from.version })} to ${request.prepared.version}, a ${request.prepared.size} change on the ${request.prepared.channel} channel, from ${request.prepared.entries.length} subjects since ${request.prepared.from.tag}. ${CHANGELOG_FILE} and ${MANIFEST_FILE} are updated in the working tree; no tag was made and nothing was published.\n`;

const unclassifiedSubjectsOf = (request: { readonly entries: readonly ChangeEntry[] }): readonly string[] =>
  request.entries.flatMap((entry) => (entry.kind === "unclassified" ? [entry.subject] : []));

const unclassifiedWarningOf = (request: { readonly subject: string }): string =>
  `${COMMAND}: ${JSON.stringify(request.subject)} is not a conventional subject; it is listed under Other changes and counted as a patch.\n`;

const refused = (request: { readonly process: ProcessPort; readonly reason: string }): void => {
  request.process.writeError({ text: `${COMMAND}: ${request.reason}\n` });
  request.process.exitWith({ code: 1 });
};

export const runReleasePullRequest = (request: ReleasePullRequestPorts): void => {
  const channelArguments = channelArgumentsSchema.safeParse(request.process.arguments);
  if (!channelArguments.success) {
    request.process.writeError({ text: USAGE });
    request.process.exitWith({ code: 2 });
    return;
  }
  const [requestedChannel] = channelArguments.data;
  const prepared = preparedRelease({ ...request, requestedChannel });
  if (prepared.outcome === "failed") {
    refused({ process: request.process, reason: prepared.error });
    return;
  }
  const written = writtenFiles({ fileText: request.fileText, files: prepared.value.files });
  if (written.outcome === "failed") {
    refused({ process: request.process, reason: written.error });
    return;
  }
  unclassifiedSubjectsOf({ entries: prepared.value.entries }).forEach((subject) => {
    request.process.writeError({ text: unclassifiedWarningOf({ subject }) });
  });
  request.process.writeOut({ text: summaryOf({ prepared: prepared.value }) });
  request.process.exitWith({ code: 0 });
};
