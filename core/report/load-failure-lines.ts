import type { z } from "zod";
import type { RunnerFailure, UnavailablePeer, UnavailablePeers } from "../mechanism-port/runner-failure.ts";
import { NOT_INSTALLED } from "../mechanism-port/toolchain-requirement.ts";
import type { RecordsDocumentRefusal } from "../records/hone-record.ts";
import { NAMED_FOLDER_KINDS, RECORDS_FILE_EXTENSION, RECORDS_FOLDER, SINGLE_FILE_KINDS } from "../records/records-layout.ts";
import type { CheckSettingsListing } from "../settings/check-choices.ts";
import { SETTINGS_FILE_NAME } from "../settings/settings-sources.ts";
import { TOOL_IDENTITY } from "../values/tool-identity.ts";
import { onOneLine, quoted } from "./printed-text.ts";
import { recordsFileText } from "./record-lines.ts";
import type { AllowedEngines, CatalogueNotRead, EngineNaming, RunLoadFailure } from "./run-load-failure.ts";

const LOAD_FAILURE_LEAD = "load failure:";

const WHOLE_DOCUMENT = "document";

const ONE_RULE_TODAY = "these checks are one rule today, so they";

const LISTED_TO_RUN = "checkSettings gives settings only to a check listed to run";

const SUPPORTED_VERSION_REPAIR = "add a supported version to the devDependencies of the repository root";

const EACH_SUPPORTED_VERSION_REPAIR = "add a supported version of each to the devDependencies of the repository root";

const conjoined = (request: { readonly items: readonly string[] }): string => `${request.items.slice(0, -1).join(", ")} and ${request.items.slice(-1).join("")}`;

const RECORDS_FILES = `${SINGLE_FILE_KINDS.map((kind) => `${kind}${RECORDS_FILE_EXTENSION}`).join(", ")}, and one ${RECORDS_FILE_EXTENSION} file for each name in ${conjoined({ items: NAMED_FOLDER_KINDS })}`;

const engineText = (request: { readonly engine: EngineNaming }): string =>
  request.engine.named === "engine" ? request.engine.engine.name : request.engine.mechanism;

const unavailablePeerRepair = (request: { readonly peer: UnavailablePeer }): string =>
  request.peer.peer === "required" && request.peer.found === NOT_INSTALLED
    ? `${request.peer.packageName} is a required peer of ${TOOL_IDENTITY.packageName}, so this install is incomplete; ${SUPPORTED_VERSION_REPAIR} and reinstall`
    : SUPPORTED_VERSION_REPAIR;

const unavailablePeersRepair = (request: { readonly peers: UnavailablePeers }): string => {
  const [first, ...rest] = request.peers;
  return rest.length === 0 ? unavailablePeerRepair({ peer: first }) : EACH_SUPPORTED_VERSION_REPAIR;
};

const unavailablePeerText = (request: { readonly peer: UnavailablePeer }): string =>
  `${request.peer.packageName} found ${request.peer.found}, supported ${request.peer.supported}`;

const runnerFailureFields = (request: { readonly failure: RunnerFailure }): readonly string[] => {
  const { failure } = request;
  switch (failure.kind) {
    case "piece-invalid":
      return [failure.kind, failure.pieceRoot, failure.detail];
    case "file-unreadable":
    case "file-unparseable":
      return [failure.kind, failure.file, failure.detail];
    case "toolchain-unavailable":
      return [failure.kind, `${failure.peers.map((peer) => unavailablePeerText({ peer })).join("; ")}: ${unavailablePeersRepair({ peers: failure.peers })}`];
    case "toolchain-shadowed":
      return [
        failure.kind,
        failure.packageName,
        `resolved from ${failure.location} inside the core install ${failure.installRoot}: delete ${failure.installRoot}/node_modules, then reinstall the package with the repository's package manager, so the repository's own copy is used`,
      ];
    case "tool-failed":
    case "plugin-conflict":
    case "team-config-unloadable":
    case "runner-invalid-output":
      return [failure.kind, failure.detail];
  }
};

const allowedText = (request: { readonly allowed: AllowedEngines }): string =>
  request.allowed.stated === "by-catalogue"
    ? `it runs on ${request.allowed.engines.join(" or ")}; list it with one of those`
    : "the rule set does not run that check on that engine, though its catalogue says it does";

const settingsListingRepair = (request: { readonly listing: CheckSettingsListing }): string =>
  request.listing === "unlisted" ? "list it under checks or remove its settings" : "run it or remove its settings";

const issueText = (request: { readonly issue: z.core.$ZodIssue }): string => {
  const path = request.issue.path.length === 0 ? WHOLE_DOCUMENT : request.issue.path.join(".");
  return `${path}: ${onOneLine({ text: request.issue.message })}`;
};

const documentRefusalText = (request: { readonly refusal: RecordsDocumentRefusal }): string => {
  const { refusal } = request;
  const lead = `${recordsFileText(refusal)} ${refusal.kind}`;
  switch (refusal.kind) {
    case "not-a-records-file":
      return lead;
    case "document-refused":
      return `${lead} ${refusal.issues.map((issue) => issueText({ issue })).join(", ")}`;
  }
};

const catalogueFields = (request: { readonly failure: CatalogueNotRead }): readonly string[] => {
  const { failure } = request;
  switch (failure.reason.reason) {
    case "absent":
      return [`${failure.path}:`, `the symptom catalogue is missing from this install; reinstall ${TOOL_IDENTITY.packageName}`];
    case "unreadable":
      return [failure.path, failure.reason.detail];
  }
};

const failureFields = (request: { readonly failure: RunLoadFailure; readonly upgradeCommand: string }): readonly string[] => {
  const { failure } = request;
  switch (failure.kind) {
    case "arguments-invalid":
    case "git-failed":
    case "unexpected-error":
      return [failure.detail];
    case "install-root-unresolvable":
      return [failure.url, failure.detail];
    case "file-unreadable":
    case "file-malformed":
    case "file-unwritable":
    case "rule-set-invalid":
      return [failure.path, failure.detail];
    case "unsupported-version":
      return [failure.path, String(JSON.stringify(failure.found))];
    case "reserved-rule-set-name":
    case "unknown-rule-set":
      return [failure.name];
    case "rule-set-name-collision":
      return [failure.name, failure.other];
    case "config-root-untracked":
      return [
        `${failure.root}:`,
        `an eslintConfigRoots entry is a folder git tracks files under outside every excluded path, spelled exactly as git spells it; fix or remove it in ${SETTINGS_FILE_NAME}`,
      ];
    case "config-absent":
      return [failure.repo, `holds no ${SETTINGS_FILE_NAME}; give the folder that holds it, usually the repository root`];
    case "unknown-check":
      return [failure.check];
    case "review-only-listed":
      return [`${failure.check}:`, "a check enforced by review has no engine and is left out of checks; remove it"];
    case "duplicate-check":
      return [failure.key, failure.check, failure.prefixedCheck];
    case "engine-not-allowed":
      return [failure.check, `${failure.engine}:`, allowedText(failure)];
    case "engine-missing":
      return [engineText(failure)];
    case "engine-invalid":
      return [engineText(failure), failure.detail];
    case "engine-failed":
      return [engineText(failure), ...runnerFailureFields({ failure: failure.failure })];
    case "check-missing":
      return [failure.check, engineText(failure)];
    case "checks-run-together":
      return [failure.check, `${failure.others.join(" ")}:`, `${ONE_RULE_TODAY} run together; list each of them as ${failure.check} is listed`];
    case "check-settings-refused":
      return [failure.check, `${failure.listing}:`, `${LISTED_TO_RUN}; ${settingsListingRepair(failure)}`];
    case "check-settings-differ":
      return [failure.check, `${failure.other}:`, `${ONE_RULE_TODAY} take one set of settings; give them the same settings`];
    case "records-folder-unreadable":
      return [recordsFileText({ file: failure.folder }), failure.detail];
    case "records-file-unreadable":
    case "records-file-not-json":
      return [recordsFileText(failure), failure.detail];
    case "not-a-records-file":
      return [`${recordsFileText(failure)}:`, `${RECORDS_FOLDER} holds ${RECORDS_FILES}; move this file out of ${RECORDS_FOLDER}`];
    case "not-a-records-name":
      return [recordsFileText({ file: failure.folder }), `${quoted({ text: failure.name })}:`, "no repository path can hold that name; rename it"];
    case "records-refused":
      return [failure.refusals.map((refusal) => documentRefusalText({ refusal })).join("; ")];
    case "catalogue-not-read":
      return catalogueFields({ failure });
    case "upgrade-needed":
      return [
        `${failure.path}:`,
        `this is a version 1 file; run ${request.upgradeCommand}, which rewrites every version 1 file as version 2, and commit what it writes`,
      ];
  }
};

export const runLoadFailureLine = (request: { readonly failure: RunLoadFailure; readonly upgradeCommand: string }): string =>
  [LOAD_FAILURE_LEAD, request.failure.kind, ...failureFields(request).map((text) => onOneLine({ text }))].join(" ");
