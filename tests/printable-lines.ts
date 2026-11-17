import { type ArgumentProblem, argumentsInvalid } from "../core/check/argument-problem.ts";
import { FORFEITURE_OPTION, REPO_OPTION } from "../core/check/command-line.ts";
import { helpText } from "../core/check/command-help.ts";
import { projectCommandOutcome } from "../core/check/command-outcome.ts";
import type { LoadFailure } from "../core/check/load-failure.ts";
import { loadFailureText } from "../core/check/load-failure-text.ts";
import type { InvalidRecord } from "../core/exception-records/exception-records.ts";
import type { ExceptionRecord } from "../core/exception-records/exception-record.ts";
import type { AttributedNativeException, Finding } from "../core/governance/governance.ts";
import type { RunnerFailure } from "../core/mechanism-port/runner-failure.ts";
import type { ProjectionWrite } from "../core/mechanism-port/runner-result-schema.ts";
import type { FilePresence } from "../core/platform-ports/file-text-port.ts";
import { WAIVED_CLAUSES_REPLACEMENT } from "../core/values/assessment.ts";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { mechanismIdSchema } from "../core/values/identifiers.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import { reportOutputSchema } from "../core/values/report-output.ts";
import type {
  AssessmentFileNote,
  AssessmentSection,
  CheckReport,
  ClauseReading,
  ProjectionProblem,
  Unmeasured,
} from "../core/verdict/check-report.ts";
import { SECTION_NAMES, sectionRoleOf } from "../core/verdict/section-roles.ts";
import type { HelpTopic } from "../core/check/command-line.ts";
import { CAUSAL_WHY_CHAIN } from "./causal-why-chain.ts";
import { type ContractLine, type DocumentedRole, reportLinesOf } from "./output-contract.ts";

type EveryKind<Union extends { readonly kind: string }> = {
  readonly [Kind in Union["kind"]]: Extract<Union, { readonly kind: Kind }>;
};

const LOOPS = clauseAddressSchema.parse("CD-15#loops");
const AUDIT = mechanismIdSchema.parse("audit");
const ESLINT = mechanismIdSchema.parse("eslint");
const FILE = repoPathSchema.parse("src/basket.ts");

const FINDING: Finding = { clause: LOOPS, mechanism: AUDIT, file: FILE, anchor: { line: 15, column: 0 }, snippet: "const total = 0;\nreturn total;" };

const RECORDS: EveryKind<ExceptionRecord> = {
  "authorised-location": { kind: "authorised-location", clause: LOOPS, mechanism: AUDIT, file: FILE, reason: "the adapter" },
  "file-carve-out": { kind: "file-carve-out", clause: LOOPS, mechanism: AUDIT, file: FILE, reason: "debt", whyChain: CAUSAL_WHY_CHAIN },
  "clause-wide-carve-out": { kind: "clause-wide-carve-out", clause: LOOPS, mechanism: AUDIT, reason: "debt", whyChain: CAUSAL_WHY_CHAIN },
};

const IMPORTED: ExceptionRecord = {
  kind: "file-carve-out",
  clause: LOOPS,
  mechanism: AUDIT,
  file: FILE,
  reason: "debt",
  provenance: { kind: "inherited-debt", source: "legacy/exceptions.json#3", decision: "kept" },
};

const NATIVE_EXCEPTIONS: EveryKind<AttributedNativeException> = {
  ignore: { kind: "ignore", clause: LOOPS, mechanism: ESLINT, file: FILE },
  "config-override": { kind: "config-override", clause: LOOPS, mechanism: ESLINT, file: FILE },
  "suppression-entry": { kind: "suppression-entry", clause: LOOPS, mechanism: ESLINT, file: FILE, location: repoPathSchema.parse("eslint-suppressions.json") },
  "inline-disable": { kind: "inline-disable", clause: LOOPS, mechanism: ESLINT, file: FILE, line: 4, text: "// eslint-disable-next-line" },
  "inline-rule-config": { kind: "inline-rule-config", clause: LOOPS, mechanism: ESLINT, file: FILE, line: 1, text: "/* eslint no-x: off */" },
  "command-line-option": {
    kind: "command-line-option",
    clause: LOOPS,
    mechanism: ESLINT,
    location: repoPathSchema.parse("package.json"),
    script: "lint",
    option: "--no-inline-config",
  },
};

const RECORD_PROBLEMS: EveryKind<InvalidRecord["problem"]> = {
  "clause-unparseable": { kind: "clause-unparseable", detail: "not a clause address" },
  "clause-not-selected": { kind: "clause-not-selected", clause: LOOPS },
  "clause-not-adopted": { kind: "clause-not-adopted", clause: LOOPS },
  "clause-not-run": { kind: "clause-not-run", clause: LOOPS },
  "file-not-repo-path": { kind: "file-not-repo-path", file: "../outside.ts" },
  "why-chain-refused": { kind: "why-chain-refused", detail: "the chain stops at a symptom" },
  "evidence-refused": { kind: "evidence-refused", detail: "no evidence" },
  "import-unverified": { kind: "import-unverified", detail: "the source has no such entry" },
  "non-exemptible-clause": { kind: "non-exemptible-clause", clause: LOOPS },
  duplicate: { kind: "duplicate", ofIndex: 0 },
};

const UNMEASURED: EveryKind<Unmeasured> = {
  "forfeiture-unmeasured": { kind: "forfeiture-unmeasured" },
  "import-unmeasured": { kind: "import-unmeasured" },
  "legacy-chain-unmeasured": { kind: "legacy-chain-unmeasured" },
  "mechanism-not-run": { kind: "mechanism-not-run", mechanism: ESLINT, projection: "missing" },
};

const UNRUN_PROJECTIONS: Readonly<Record<Extract<Unmeasured, { readonly kind: "mechanism-not-run" }>["projection"], Unmeasured>> = {
  missing: { kind: "mechanism-not-run", mechanism: ESLINT, projection: "missing" },
  "not-included": { kind: "mechanism-not-run", mechanism: ESLINT, projection: "not-included", nestedConfigurations: [] },
};

const NESTED_UNRUN: Unmeasured = {
  kind: "mechanism-not-run",
  mechanism: ESLINT,
  projection: "not-included",
  nestedConfigurations: [repoPathSchema.parse("packages/legacy"), repoPathSchema.parse("packages/tools")],
};

const SLICE_PROBLEMS: Readonly<Record<Extract<ProjectionProblem, { readonly scope: "slice" }>["state"], ProjectionProblem>> = {
  "out-of-date": { scope: "slice", mechanism: ESLINT, state: "out-of-date", slice: repoPathSchema.parse("packages/web/disciplines.eslint.mjs") },
  missing: { scope: "slice", mechanism: ESLINT, state: "missing", slice: repoPathSchema.parse("packages/web/disciplines.eslint.mjs") },
  "not-applied": { scope: "slice", mechanism: ESLINT, state: "not-applied", slice: repoPathSchema.parse("packages/web/disciplines.eslint.mjs") },
  unconfigured: { scope: "slice", mechanism: ESLINT, state: "unconfigured", slice: repoPathSchema.parse("packages/api/disciplines.eslint.mjs") },
};

const PROJECTION_EFFECTS: Readonly<Record<ProjectionWrite["effect"], ProjectionWrite>> = {
  written: { path: repoPathSchema.parse("disciplines.eslint.mjs"), effect: "written" },
  unchanged: { path: repoPathSchema.parse("packages/web/disciplines.eslint.mjs"), effect: "unchanged" },
  removed: { path: repoPathSchema.parse("packages/old/disciplines.eslint.mjs"), effect: "removed" },
  "left-in-place": { path: repoPathSchema.parse("packages/kept/disciplines.eslint.mjs"), effect: "left-in-place" },
};

const readingOf = (request: { readonly assessmentSection: AssessmentSection; readonly presence: FilePresence }): ClauseReading => ({
  kind: "clause",
  clause: LOOPS,
  assessmentSection: request.assessmentSection,
  rulePage: { path: "node_modules/@hailstails/hone/rules/CD-15/README.md", presence: request.presence },
});

const READINGS: Readonly<Record<AssessmentSection, Readonly<Record<FilePresence, ClauseReading>>>> = {
  present: { present: readingOf({ assessmentSection: "present", presence: "present" }), absent: readingOf({ assessmentSection: "present", presence: "absent" }) },
  "not-assessed": {
    present: readingOf({ assessmentSection: "not-assessed", presence: "present" }),
    absent: readingOf({ assessmentSection: "not-assessed", presence: "absent" }),
  },
  unread: { present: readingOf({ assessmentSection: "unread", presence: "present" }), absent: readingOf({ assessmentSection: "unread", presence: "absent" }) },
};

const NOTES: Readonly<Record<AssessmentFileNote["state"], AssessmentFileNote>> = {
  "not-written": { kind: "assessment-file", state: "not-written", guide: "node_modules/@hailstails/hone/ADOPTING.md" },
  unreadable: { kind: "assessment-file", state: "unreadable", guide: "node_modules/@hailstails/hone/ADOPTING.md" },
};

const EMPTY_REPORT: CheckReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  findings: [],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  readFirst: [],
};

const EVERY_ENTRY: CheckReport = {
  excluded: [repoPathSchema.parse("generated")],
  notAdopted: [LOOPS],
  notRun: [LOOPS],
  findings: [FINDING],
  exempted: [...Object.values(RECORDS).map((record) => ({ finding: FINDING, by: [record] })), { finding: FINDING, by: [IMPORTED] }],
  uncovered: [LOOPS],
  stale: Object.values(RECORDS),
  forfeited: [RECORDS["file-carve-out"]],
  unrecorded: Object.values(NATIVE_EXCEPTIONS),
  doublyHeld: [{ clause: LOOPS, file: FILE, mechanism: AUDIT }],
  invalidRecords: Object.values(RECORD_PROBLEMS).map((problem, index) => ({ index, problem })),
  unmeasured: [...Object.values(UNMEASURED), ...Object.values(UNRUN_PROJECTIONS), NESTED_UNRUN],
  projectionProblems: [{ scope: "projection", mechanism: ESLINT, state: "out-of-date" }, ...Object.values(SLICE_PROBLEMS)],
  assessment: [
    { concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 1 },
    { concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 37 },
  ],
  readFirst: Object.values(READINGS).flatMap((byPresence) => Object.values(byPresence)),
};

const NOTED_REPORTS: readonly CheckReport[] = Object.values(NOTES).flatMap((note) => [
  { ...EMPTY_REPORT, findings: [FINDING], readFirst: [note, READINGS.unread.present] },
  { ...EMPTY_REPORT, findings: [FINDING], readFirst: [note, READINGS.unread.absent] },
]);

const VERDICT_REPORTS: readonly CheckReport[] = [
  EMPTY_REPORT,
  { ...EMPTY_REPORT, assessment: EVERY_ENTRY.assessment },
  { ...EVERY_ENTRY, assessment: [] },
];

const REPORT_LINES: readonly ContractLine[] = [
  ...reportOutputSchema.options.flatMap((output) => reportLinesOf({ report: EVERY_ENTRY, output })),
  ...[...NOTED_REPORTS, ...VERDICT_REPORTS].flatMap((report) => reportLinesOf({ report, output: "full" })),
];

const PEER = { packageName: "eslint", peer: "required", supported: "^9.0.0 || ^10.0.0", found: "8.57.0" } as const;

const RUNNER_FAILURES: EveryKind<RunnerFailure> = {
  "piece-invalid": { kind: "piece-invalid", pieceRoot: "mechanisms/eslint/CD-1", detail: "no module" },
  "file-unreadable": { kind: "file-unreadable", file: FILE, detail: "EACCES" },
  "file-unparseable": { kind: "file-unparseable", file: FILE, detail: "unexpected token" },
  "tool-failed": { kind: "tool-failed", detail: "eslint exited 2" },
  "plugin-conflict": { kind: "plugin-conflict", detail: "two copies of the plugin" },
  "team-config-unloadable": { kind: "team-config-unloadable", detail: "eslint.config.mjs threw" },
  "runner-invalid-output": { kind: "runner-invalid-output", detail: "not an array" },
  "toolchain-unavailable": { kind: "toolchain-unavailable", peers: [PEER] },
  "toolchain-shadowed": { kind: "toolchain-shadowed", packageName: "eslint", location: "/install/node_modules/eslint", installRoot: "/install" },
};

const UNAVAILABLE_TOOLCHAINS: readonly RunnerFailure[] = [
  { kind: "toolchain-unavailable", peers: [{ ...PEER, found: "not installed" }] },
  { kind: "toolchain-unavailable", peers: [PEER, { ...PEER, packageName: "typescript-eslint" }] },
];

const LOAD_FAILURES: EveryKind<LoadFailure> = {
  "arguments-invalid": { kind: "arguments-invalid", detail: "--repo needs a value" },
  "install-root-unresolvable": { kind: "install-root-unresolvable", url: "https://example.invalid/tool.js", detail: "not a file URL" },
  "file-unreadable": { kind: "file-unreadable", path: "/repo/disciplines.json", detail: "EACCES" },
  "file-malformed": { kind: "file-malformed", path: "/repo/disciplines.json", detail: "clauses is not an object" },
  "unsupported-version": { kind: "unsupported-version", path: "/repo/disciplines.json", found: 2 },
  "reserved-rule-set-name": { kind: "reserved-rule-set-name", name: "hone" },
  "rule-set-name-collision": { kind: "rule-set-name-collision", name: "team", other: "team-web" },
  "duplicate-clause": { kind: "duplicate-clause", address: "CD-15#loops", prefixedAddress: "hone/CD-15#loops" },
  "unknown-rule-set": { kind: "unknown-rule-set", name: "team" },
  "unknown-discipline": { kind: "unknown-discipline", address: "CD-99#loops" },
  "unknown-clause": { kind: "unknown-clause", address: "CD-15#whiles" },
  "judgement-clause-selected": { kind: "judgement-clause-selected", address: "CD-3#names" },
  "judgement-clause-listed": { kind: "judgement-clause-listed", address: "CD-3#names" },
  "mechanism-not-allowed": { kind: "mechanism-not-allowed", address: "CD-15#loops", mechanism: ESLINT },
  "runner-missing": { kind: "runner-missing", mechanism: ESLINT },
  "runner-invalid": { kind: "runner-invalid", mechanism: ESLINT, detail: "no runner export" },
  "piece-missing": { kind: "piece-missing", address: "CD-15#loops", mechanism: ESLINT },
  "rule-set-invalid": { kind: "rule-set-invalid", path: "/repo/team/rules/TM-1/discipline.json", detail: "no clauses" },
  "git-failed": { kind: "git-failed", detail: "not a git repository" },
  "config-root-untracked": { kind: "config-root-untracked", root: repoPathSchema.parse("packages/gone") },
  "runner-failed": { kind: "runner-failed", mechanism: ESLINT, failure: RUNNER_FAILURES["tool-failed"] },
};

const ARGUMENT_PROBLEMS: EveryKind<ArgumentProblem> = {
  "command-missing": { kind: "command-missing" },
  "command-unknown": { kind: "command-unknown", given: "lint" },
  "argument-unexpected": { kind: "argument-unexpected", subcommand: "check", given: "src" },
  "option-unknown": { kind: "option-unknown", subcommand: "project", given: "--fix" },
  "option-joined": { kind: "option-joined", option: REPO_OPTION, given: "--repo=src" },
  "value-missing": { kind: "value-missing", option: REPO_OPTION },
  "option-repeated": { kind: "option-repeated", option: FORFEITURE_OPTION },
  "option-required": { kind: "option-required", subcommand: "check", option: REPO_OPTION },
  "choice-invalid": { kind: "choice-invalid", option: FORFEITURE_OPTION, choices: ["this-run", "elsewhere"], given: "later" },
  "option-removed": { kind: "option-removed", given: "--waived-clauses", instead: WAIVED_CLAUSES_REPLACEMENT },
  "repo-unresolvable": { kind: "repo-unresolvable", given: "src" },
  "selection-absent": { kind: "selection-absent", given: "src" },
};

const failureLine = (request: { readonly label: string; readonly failure: LoadFailure }): ContractLine => ({
  label: request.label,
  text: loadFailureText(request).trimEnd(),
});

const FAILURE_LINES: readonly ContractLine[] = [
  ...Object.values(LOAD_FAILURES).map((failure) => failureLine({ label: failure.kind, failure })),
  ...[...Object.values(RUNNER_FAILURES), ...UNAVAILABLE_TOOLCHAINS].map((failure) =>
    failureLine({ label: "runner-failed", failure: { kind: "runner-failed", mechanism: ESLINT, failure } }),
  ),
  ...Object.values(ARGUMENT_PROBLEMS).map((problem) => failureLine({ label: problem.kind, failure: argumentsInvalid({ problem }).error })),
];

const PROJECT_LINES: readonly ContractLine[] = projectCommandOutcome({
  result: {
    outcome: "ok",
    value: Object.values(PROJECTION_EFFECTS),
  },
})
  .text.trimEnd()
  .split("\n")
  .map((text) => ({ label: "project", text }));

export const PRINTABLE_LINES: readonly ContractLine[] = [...REPORT_LINES, ...FAILURE_LINES, ...PROJECT_LINES, { label: "version", text: "1.0.0" }];

export const PRINTED_SECTION_ROLES: readonly DocumentedRole[] = SECTION_NAMES.map((section) => ({ section, role: sectionRoleOf({ section }) }));

const HELP_TOPICS: readonly HelpTopic[] = ["tool", "check", "project"];

const FENCE = "```";

export const PRINTED_HELP_BLOCKS: readonly string[] = HELP_TOPICS.map((topic) => `${FENCE}text\n${helpText({ topic })}${FENCE}`);
