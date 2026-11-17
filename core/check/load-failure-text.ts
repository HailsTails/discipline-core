import type { PeerKind, RunnerFailure } from "../mechanism-port/runner-failure.ts";
import { NOT_INSTALLED } from "../mechanism-port/toolchain-requirement.ts";
import { TOOL_IDENTITY } from "../values/tool-identity.ts";
import type { LoadFailure } from "./load-failure.ts";

const escapedLineBreaks = (request: { readonly text: string }): string =>
  request.text.replaceAll("\n", "\\n").replaceAll("\r", "\\r");

const JUDGEMENT_CLAUSE_LISTED_REPAIR =
  "a judgement clause is enforced by review and is left out of clauses, adopted or not; remove it";

const SUPPORTED_VERSION_REPAIR = "add a supported version to the devDependencies of the repository root";

const unavailablePeerRepair = (request: { readonly packageName: string; readonly peer: PeerKind; readonly found: string }): string =>
  request.peer === "required" && request.found === NOT_INSTALLED
    ? `${request.packageName} is a required peer of ${TOOL_IDENTITY.packageName}, so this install is incomplete; ${SUPPORTED_VERSION_REPAIR} and reinstall`
    : SUPPORTED_VERSION_REPAIR;

const runnerFailureFields = (request: { readonly failure: RunnerFailure }): readonly string[] => {
  switch (request.failure.kind) {
    case "piece-invalid":
      return [request.failure.kind, request.failure.pieceRoot, request.failure.detail];
    case "file-unreadable":
    case "file-unparseable":
      return [request.failure.kind, request.failure.file, request.failure.detail];
    case "toolchain-unavailable":
      return [
        request.failure.kind,
        request.failure.packageName,
        `found ${request.failure.found}, supported ${request.failure.supported}: ${unavailablePeerRepair({ packageName: request.failure.packageName, peer: request.failure.peer, found: request.failure.found })}`,
      ];
    case "toolchain-shadowed":
      return [
        request.failure.kind,
        request.failure.packageName,
        `resolved from ${request.failure.location} inside the core install ${request.failure.installRoot}: delete ${request.failure.installRoot}/node_modules, then reinstall the package with the repository's package manager, so the repository's own copy is used`,
      ];
    case "tool-failed":
    case "plugin-conflict":
    case "team-config-unloadable":
    case "runner-invalid-output":
      return [request.failure.kind, request.failure.detail];
  }
};

const loadFailureFields = (request: { readonly failure: LoadFailure }): readonly string[] => {
  switch (request.failure.kind) {
    case "arguments-invalid":
    case "git-failed":
      return [request.failure.detail];
    case "install-root-unresolvable":
      return [request.failure.url, request.failure.detail];
    case "file-unreadable":
    case "file-malformed":
    case "rule-set-invalid":
      return [request.failure.path, request.failure.detail];
    case "unsupported-version":
      return [request.failure.path, String(JSON.stringify(request.failure.found))];
    case "reserved-rule-set-name":
    case "unknown-rule-set":
      return [request.failure.name];
    case "duplicate-clause":
      return [request.failure.address, request.failure.prefixedAddress];
    case "rule-set-name-collision":
      return [request.failure.name, request.failure.other];
    case "unknown-discipline":
    case "unknown-clause":
    case "judgement-clause-selected":
      return [request.failure.address];
    case "judgement-clause-listed":
      return [`${request.failure.address}:`, JUDGEMENT_CLAUSE_LISTED_REPAIR];
    case "mechanism-not-allowed":
    case "piece-missing":
      return [request.failure.address, request.failure.mechanism];
    case "runner-missing":
      return [request.failure.mechanism];
    case "runner-invalid":
      return [request.failure.mechanism, request.failure.detail];
    case "runner-failed":
      return [request.failure.mechanism, ...runnerFailureFields({ failure: request.failure.failure })];
  }
};

export const loadFailureText = (request: { readonly failure: LoadFailure }): string =>
  `${["load failure:", request.failure.kind, ...loadFailureFields(request)]
    .map((text) => escapedLineBreaks({ text }))
    .join(" ")}\n`;
