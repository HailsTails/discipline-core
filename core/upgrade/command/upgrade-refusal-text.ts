import { loadFailureDetail } from "../../command-line/load-failure-text.ts";
import { TOOL_IDENTITY } from "../../values/tool-identity.ts";
import type { InvalidRecord } from "../version-one-records/exception-record.ts";
import type { PlanRefusal } from "../proof/upgrade-plan.ts";
import type { ProofRefusal } from "../proof/upgrade-proof.ts";
import type { ProofWriteFailure, Unrestored } from "../proof-writes/proof-writes.ts";
import type { UpgradeRefusal } from "../version-two-mapping/upgrade-refusal.ts";
import type { ConfigImportRefusal } from "../version-two-writer/config-import-rewrite.ts";
import type { OracleFailure } from "../carve-out-oracle/carve-out-oracle.ts";
import type { TeamConfigRefusal } from "./team-config-finder.ts";
import type { VersionOneReadFailure } from "./version-one-reading.ts";

export const UPGRADE_ISSUES_URL = `${TOOL_IDENTITY.repository}/issues`;

export type UpgradeFailure = VersionOneReadFailure | ProofRefusal;

export type UpgradeFailureCode = 1 | 2 | 3;

export type UpgradeFailureOutcome = { readonly code: UpgradeFailureCode; readonly text: string };

const NOTHING_CHANGED = "Nothing was changed.";

const FAULT_IN_HONE = `This is a fault in hone, not in your repository. Report it at ${UPGRADE_ISSUES_URL}, with this output.`;

const unrestoredLinesOf = (request: { readonly unrestored: readonly Unrestored[] }): readonly string[] =>
  request.unrestored.length === 0
    ? [NOTHING_CHANGED]
    : [
        "These files could not be put back; restore them from version control:",
        ...request.unrestored.map(({ path, detail }) => `  ${path}: ${detail}`),
      ];

const oracleLineOf = (request: { readonly failure: OracleFailure }): string => {
  const { failure } = request;
  switch (failure.kind) {
    case "version-one-run-failed":
      return `version 1's own run could not be made (${failure.detail}). Run hone check and fix its load failure first.`;
    case "finding-not-attributable":
      return `a finding of ${failure.clause} in ${failure.file} names no check of version 2. Report it at ${UPGRADE_ISSUES_URL}.`;
    case "record-doubly-held":
      return `${failure.clause} in ${failure.file} is held by both a file carve-out and an authorised location. Remove one of them first, then run the upgrade again.`;
  }
};

const mappingLineOf = (request: { readonly refusal: UpgradeRefusal }): string => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "eslint-config-roots":
      return `eslintConfigRoots (${refusal.roots.join(", ")}) is not carried over; the upgrade handles a single repository-root ESLint config.`;
    case "clause-without-check":
      return `${refusal.clause} has no version 2 check to run it.`;
    case "no-engine-on-mechanism":
      return `${refusal.check} has no engine on the ${refusal.mechanism} mechanism.`;
    case "two-engines-on-mechanism":
      return `${refusal.check} could run on ${refusal.engines.join(" or ")} through the ${refusal.mechanism} mechanism; the upgrade cannot choose.`;
    case "record-answers-nothing":
      return `the file carve-out for ${refusal.clause} in ${refusal.file} answers ${refusal.credited === "nothing" ? "no finding" : "only a suppression"}. Remove it, or fix the file it names, then run the upgrade again.`;
    case "clause-wide-carve-out":
      return `${refusal.clause} carries a clause-wide carve-out, which version 2 has no record for. Replace it with file carve-outs first.`;
    case "records-name-refused":
      return `${refusal.name} is not a name version 2 can file records under.`;
  }
};

const configLineOf = (request: { readonly refusal: ConfigImportRefusal }): string => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "no-projection-import":
      return `${refusal.file} holds no static default import of the version 1 projection. Make its import of it a static relative default import.`;
    case "several-projection-imports":
      return `${refusal.file} imports the version 1 projection ${refusal.count} times. Import it once.`;
    case "projection-named-elsewhere":
      return `${refusal.file} names the version 1 projection outside its import. Remove the other mention.`;
  }
};

const planLinesOf = (request: { readonly refusal: PlanRefusal }): readonly string[] => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "carve-out-unanswered":
      return [`the carve-out for ${refusal.clause} in ${refusal.file} was given no answer. ${FAULT_IN_HONE}`];
    case "mapping-refused":
      return refusal.refusals.map((each) => mappingLineOf({ refusal: each }));
    case "reach-beyond-entries":
      return [
        `the version 2 records would reach beyond the version 1 entries: ${refusal.records.map(({ symptom, file }) => `${symptom} in ${file}`).join(", ")}.`,
        FAULT_IN_HONE,
      ];
    case "config-import-refused":
      return [configLineOf({ refusal: refusal.refusal })];
  }
};

const writeLineOf = (request: { readonly failure: ProofWriteFailure }): string => {
  const { failure } = request;
  switch (failure.kind) {
    case "path-already-exists":
      return `${failure.path} already exists. Move it aside, then run the upgrade again.`;
    case "replaced-file-unreadable":
      return `${failure.path} could not be read to be replaced (${failure.detail}).`;
    case "directory-uncreatable":
      return `${failure.path} could not be created (${failure.detail}).`;
    case "unwritable":
      return `${failure.path} could not be written (${failure.detail}).`;
  }
};

const recordsRefusalLinesOf = (request: { readonly invalid: readonly InvalidRecord[] }): readonly string[] =>
  request.invalid.map(({ place, problem }) => `${place.file} entry ${place.index}: ${problem.kind}`);

const readFailureLinesOf = (request: { readonly failure: VersionOneReadFailure }): readonly string[] => {
  const { failure } = request;
  switch (failure.kind) {
    case "version-one-unreadable":
      return [`version 1's files could not be read (${loadFailureDetail({ failure: failure.failure })}). Run hone check and fix its load failure first.`];
    case "records-refused":
      return failure.refusal.kind === "invalid-records"
        ? ["the version 1 records are invalid; fix them first:", ...recordsRefusalLinesOf({ invalid: failure.refusal.invalid })]
        : [`a version 1 record in ${failure.refusal.place.file} is not JSON. Fix it first.`];
    case "several-version-one-projections":
      return [`several version 1 projections are present: ${failure.projections.join(", ")}. The upgrade carries one.`];
    case "team-config-refused":
      return teamConfigLinesOf({ refusal: failure.refusal });
  }
};

const teamConfigLinesOf = (request: { readonly refusal: TeamConfigRefusal }): readonly string[] => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "no-file-imports-projection":
      return [`no file imports ${refusal.projection}. Import it from your ESLint config with a static relative import.`];
    case "several-files-import-projection":
      return [`several files import ${refusal.projection}: ${refusal.files.join(", ")}. Leave one importing it.`];
    case "config-candidate-unreadable":
      return [`${refusal.file} could not be read (${refusal.detail}).`];
  }
};

const removalLineOf = (request: { readonly failure: Extract<ProofRefusal, { readonly kind: "removal-failed" }>["failure"] }): string =>
  request.failure.kind === "unremovable"
    ? `${request.failure.path} could not be removed (${request.failure.detail})`
    : `${request.failure.path} is outside ${request.failure.root}`;

const differenceLinesOf = (request: { readonly failure: Extract<ProofRefusal, { readonly kind: "differences" }> }): readonly string[] =>
  request.failure.differences.flatMap(({ section, onlyBefore, onlyAfter }) => [
    `  ${section}:`,
    ...onlyBefore.map((line) => `    only before: ${line}`),
    ...onlyAfter.map((line) => `    only after: ${line}`),
  ]);

const proofLinesOf = (request: { readonly failure: ProofRefusal }): { readonly code: UpgradeFailureCode; readonly lines: readonly string[] } => {
  const { failure } = request;
  switch (failure.kind) {
    case "oracle-failed":
      return { code: 1, lines: [oracleLineOf({ failure: failure.failure }), NOTHING_CHANGED] };
    case "plan-refused":
      return { code: 1, lines: [...planLinesOf({ refusal: failure.refusal }), NOTHING_CHANGED] };
    case "version-one-run-failed":
      return { code: 1, lines: [`version 1's run failed (${failure.failure.detail}). Run hone check and fix its load failure first.`, NOTHING_CHANGED] };
    case "unplaceable-path":
      return { code: 1, lines: [`${failure.file} cannot be placed in the repository. ${FAULT_IN_HONE}`, NOTHING_CHANGED] };
    case "removal-refused":
      return { code: 1, lines: [`the version 1 records file ${failure.failure.path} is outside ${failure.failure.root}. ${FAULT_IN_HONE}`, NOTHING_CHANGED] };
    case "write-refused":
      return { code: 1, lines: [writeLineOf({ failure: failure.refusal.failure }), ...unrestoredLinesOf({ unrestored: failure.refusal.unrestored })] };
    case "version-two-run-failed":
      return { code: 1, lines: [`version 2's run failed (${failure.failure.detail}). ${FAULT_IN_HONE}`, ...unrestoredLinesOf({ unrestored: failure.unrestored })] };
    case "differences":
      return {
        code: 1,
        lines: ["version 2 does not report what version 1 reported:", ...differenceLinesOf({ failure }), FAULT_IN_HONE, ...unrestoredLinesOf({ unrestored: failure.unrestored })],
      };
    case "removal-failed":
      return {
        code: 3,
        lines: [
          `version 2 is in place (written: ${failure.written.join(", ")}${failure.replaced === undefined ? "" : `; replaced: ${failure.replaced}`}), but ${removalLineOf({ failure: failure.failure })}.`,
          "Delete the remaining version 1 files by hand, then commit.",
        ],
      };
  }
};

export const upgradeFailureOutcomeOf = (request: { readonly failure: UpgradeFailure }): UpgradeFailureOutcome => {
  const { failure } = request;
  if (failure.kind === "version-one-unreadable" || failure.kind === "records-refused" || failure.kind === "several-version-one-projections" || failure.kind === "team-config-refused") {
    return { code: 1, text: `${["upgrade refused:", ...readFailureLinesOf({ failure }), NOTHING_CHANGED].join("\n")}\n` };
  }
  const proof = proofLinesOf({ failure });
  return { code: proof.code, text: `${[proof.code === 3 ? "upgrade incomplete:" : "upgrade refused:", ...proof.lines].join("\n")}\n` };
};
