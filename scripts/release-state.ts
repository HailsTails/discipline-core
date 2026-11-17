import { z } from "zod";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import type { Result } from "../core/values/result.ts";
import { packageVersionOf } from "./published-manifest.ts";
import { RELEASE_TAG_PREFIX, versionOf } from "./release-version.ts";

export type ReleaseStateName = "version-unchanged" | "already-released" | "unreleased";

export type ReleaseState = { readonly tag: string; readonly state: ReleaseStateName };

type ReleaseStateRequest = { readonly manifest: string; readonly previousManifest: string; readonly remoteTags: string };

type VersionChange = { readonly version: string; readonly previousVersion: string };

const COMMAND = "release-state";

const USAGE = `usage: ${COMMAND} <package.json> <previous package.json> <git ls-remote tags>\n`;

const releaseStateArgumentsSchema = z.tuple([z.string(), z.string(), z.string()]);

const REMOTE_TAG_LINE = /^[0-9a-f]+\trefs\/tags\/(?<tag>.+)$/;

const remoteTagNamesOf = (request: { readonly remoteTags: string }): Result<readonly string[], string> =>
  request.remoteTags
    .split("\n")
    .filter((line) => line !== "")
    .reduce<Result<readonly string[], string>>((soFar, line) => {
      if (soFar.outcome === "failed") {
        return soFar;
      }
      const tag = REMOTE_TAG_LINE.exec(line)?.groups?.tag;
      return tag === undefined
        ? { outcome: "failed", error: `cannot read the remote's tags: ${JSON.stringify(line)} is not a git ls-remote tag line` }
        : { outcome: "ok", value: [...soFar.value, tag] };
    }, { outcome: "ok", value: [] });

const versionChangeOf = (request: ReleaseStateRequest): Result<VersionChange, string> => {
  const version = packageVersionOf({ developmentManifest: request.manifest });
  if (version.outcome === "failed") {
    return { outcome: "failed", error: `package.json has no readable version: ${version.error.detail}` };
  }
  const previousVersion = packageVersionOf({ developmentManifest: request.previousManifest });
  return previousVersion.outcome === "failed"
    ? { outcome: "failed", error: `the previous package.json has no readable version: ${previousVersion.error.detail}` }
    : { outcome: "ok", value: { version: version.value, previousVersion: previousVersion.value } };
};

const changedVersionStateOf = (request: { readonly version: string; readonly tag: string; readonly remoteTags: string }): Result<ReleaseState, string> => {
  if (versionOf({ text: request.version }).outcome === "failed") {
    return {
      outcome: "failed",
      error: `package.json's version ${request.version} is not one this workflow releases: major.minor.patch, optionally followed by -<identifier>.<number>`,
    };
  }
  const remoteTagNames = remoteTagNamesOf({ remoteTags: request.remoteTags });
  if (remoteTagNames.outcome === "failed") {
    return remoteTagNames;
  }
  return { outcome: "ok", value: { tag: request.tag, state: remoteTagNames.value.includes(request.tag) ? "already-released" : "unreleased" } };
};

export const releaseStateOf = (request: ReleaseStateRequest): Result<ReleaseState, string> => {
  const change = versionChangeOf(request);
  if (change.outcome === "failed") {
    return change;
  }
  const tag = `${RELEASE_TAG_PREFIX}${change.value.version}`;
  return change.value.version === change.value.previousVersion
    ? { outcome: "ok", value: { tag, state: "version-unchanged" } }
    : changedVersionStateOf({ version: change.value.version, tag, remoteTags: request.remoteTags });
};

const versionOfTag = (request: { readonly tag: string }): string => request.tag.slice(RELEASE_TAG_PREFIX.length);

const explanationOf = (request: { readonly state: ReleaseState }): string => {
  const version = versionOfTag({ tag: request.state.tag });
  switch (request.state.state) {
    case "version-unchanged":
      return `this push leaves the version at ${version}, so it releases nothing.`;
    case "already-released":
      return `the remote already has the tag ${request.state.tag}, so ${version} is released and this push releases nothing.`;
    case "unreleased":
      return `this push changes the version to ${version} and the remote has no tag ${request.state.tag}, so it releases it.`;
  }
};

export const runReleaseState = (request: { readonly process: ProcessPort }): void => {
  const parsed = releaseStateArgumentsSchema.safeParse(request.process.arguments);
  if (!parsed.success) {
    request.process.writeError({ text: USAGE });
    request.process.exitWith({ code: 2 });
    return;
  }
  const [manifest, previousManifest, remoteTags] = parsed.data;
  const state = releaseStateOf({ manifest, previousManifest, remoteTags });
  if (state.outcome === "failed") {
    request.process.writeError({ text: `${COMMAND}: ${state.error}\n` });
    request.process.exitWith({ code: 1 });
    return;
  }
  request.process.writeError({ text: `${COMMAND}: ${explanationOf({ state: state.value })}\n` });
  request.process.writeOut({ text: `tag=${state.value.tag}\nstate=${state.value.state}\n` });
  request.process.exitWith({ code: 0 });
};
