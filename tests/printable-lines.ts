import { type ArgumentProblem, argumentsInvalid } from "../core/check/argument-problem.ts";
import { helpText, SYNOPSIS } from "../core/check/command-help.ts";
import { FORFEITURE_OPTION, type HelpTopic, LEAVE_OPTION, REPO_OPTION, SUBCOMMANDS } from "../core/check/command-line.ts";
import { projectCommandOutcome, recordDebtCommandOutcome, splitRecordsCommandOutcome, versionCommandOutcome } from "../core/check/command-outcome.ts";
import { installedVersionOf } from "../core/check/installed-version.ts";
import type { LoadFailure } from "../core/check/load-failure.ts";
import { loadFailureText } from "../core/check/load-failure-text.ts";
import type { ExceptionRecord } from "../core/exception-records/exception-record.ts";
import type { InheritedDebtOutcome } from "../core/exception-records/inherited-debt.ts";
import type {
  ExistingAuthorisationProvenance,
  InheritedDebtProvenance,
  InvalidRecord,
  RecordsSplit,
} from "../core/exception-records/exception-records.ts";
import type { AttributedNativeException, Finding } from "../core/governance/governance.ts";
import type { RunnerFailure } from "../core/mechanism-port/runner-failure.ts";
import type { ProjectionWrite } from "../core/mechanism-port/runner-result-schema.ts";
import type { FilePresence, FileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import { WAIVED_CLAUSES_REPLACEMENT } from "../core/values/assessment.ts";
import type { BaseRevisionAvailability } from "../core/values/base-revision-availability.ts";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { type ClauseEditionReading, editionSchema } from "../core/values/edition.ts";
import { mechanismIdSchema } from "../core/values/identifiers.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import { type ReportOutput, reportOutputSchema } from "../core/values/report-output.ts";
import type {
  AssessmentFileNote,
  AssessmentSection,
  CheckReport,
  ClauseReading,
  PartialAssessment,
  ProjectionProblem,
  Unmeasured,
} from "../core/verdict/check-report.ts";
import { SECTION_NAMES, type SectionName, sectionRoleOf } from "../core/verdict/section-roles.ts";
import type { Verdict } from "../core/verdict/verdict.ts";
import { CAUSAL_WHY_CHAIN } from "./causal-why-chain.ts";
import { type DocumentedRole, type EntryFills, type Fills, type PrintedLine, reportLinesOf } from "./output-contract.ts";

type EveryKind<Union extends { readonly kind: string }> = {
  readonly [Kind in Union["kind"]]: Extract<Union, { readonly kind: Kind }>;
};

type Filled<Entry> = {
  readonly entry: Entry;
  readonly fills: Fills;
};

type SectionSamples = {
  readonly [Name in SectionName]: readonly Filled<CheckReport[Name][number]>[];
};

const LOOPS = clauseAddressSchema.parse("CD-15#loops");
const MECHANISM = mechanismIdSchema.parse("eslint");
const FILE = repoPathSchema.parse("src/basket.ts");
const RULE_PAGE = "node_modules/@hailstails/hone/rules/CD-15/README.md";
const ADOPTION_GUIDE = "node_modules/@hailstails/hone/ADOPTING.md";

const PROJECT_COMMAND = "node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js project --repo /work/shop";

const SHARED_FILLS: Fills = {
  clause: "CD-15#loops",
  mechanism: "eslint",
  file: "src/basket.ts",
  line: "15",
  column: "0",
  snippet: "const total = 0;\\nreturn total;",
  "rule page": RULE_PAGE,
  "adoption guide": ADOPTION_GUIDE,
  "project command": PROJECT_COMMAND,
};

const EDITION_READING: ClauseEditionReading = {
  address: LOOPS,
  mechanism: MECHANISM,
  edition: editionSchema.parse("1"),
  latest: editionSchema.parse("2"),
};

const FINDING: Finding = { clause: LOOPS, mechanism: MECHANISM, file: FILE, anchor: { line: 15, column: 0 }, snippet: "const total = 0;\nreturn total;" };

const RECORDS: EveryKind<ExceptionRecord> = {
  "authorised-location": { kind: "authorised-location", clause: LOOPS, mechanism: MECHANISM, file: FILE, reason: "the adapter" },
  "file-carve-out": { kind: "file-carve-out", clause: LOOPS, mechanism: MECHANISM, file: FILE, reason: "debt", whyChain: CAUSAL_WHY_CHAIN },
  "clause-wide-carve-out": { kind: "clause-wide-carve-out", clause: LOOPS, mechanism: MECHANISM, reason: "debt", whyChain: CAUSAL_WHY_CHAIN },
};

const IMPORTED_RECORDS: Readonly<Record<(ExistingAuthorisationProvenance | InheritedDebtProvenance)["kind"], Filled<ExceptionRecord>>> = {
  "existing-authorisation": {
    entry: {
      kind: "authorised-location",
      clause: LOOPS,
      mechanism: MECHANISM,
      file: FILE,
      reason: "the adapter",
      provenance: { kind: "existing-authorisation", source: "legacy/authorisations.json#2" },
    },
    fills: { "record kind": "authorised-location", source: "legacy/authorisations.json#2" },
  },
  "inherited-debt": {
    entry: {
      kind: "file-carve-out",
      clause: LOOPS,
      mechanism: MECHANISM,
      file: FILE,
      reason: "debt",
      provenance: { kind: "inherited-debt", source: "legacy/exceptions.json#3", decision: "kept" },
    },
    fills: { "record kind": "file-carve-out", source: "legacy/exceptions.json#3" },
  },
};

type AttributedInlineDisable = Extract<AttributedNativeException, { readonly kind: "inline-disable" }>;

type AttributedScriptOption = Extract<AttributedNativeException, { readonly kind: "command-line-option" }>;

const INLINE_DISABLES: Readonly<Record<AttributedInlineDisable["reach"], Filled<AttributedInlineDisable>>> = {
  "one-clause": {
    entry: { kind: "inline-disable", clause: LOOPS, mechanism: MECHANISM, file: FILE, line: 4, text: "// eslint-disable-next-line", reach: "one-clause" },
    fills: { line: "4", comment: "// eslint-disable-next-line" },
  },
  "every-selected-clause": {
    entry: { kind: "inline-disable", clause: LOOPS, mechanism: MECHANISM, file: FILE, line: 1, text: "/* eslint-disable */", reach: "every-selected-clause" },
    fills: { line: "1", comment: "/* eslint-disable */" },
  },
};

const SCRIPT_OPTION_INVOCATION = "TIMING=1 eslint -c eslint.config.mjs .";

const SCRIPT_OPTION_WRAPPER = "env";

const SCRIPT_OPTIONS: Readonly<Record<AttributedScriptOption["cause"]["kind"], Filled<AttributedScriptOption>>> = {
  "weakens-run": {
    entry: {
      kind: "command-line-option",
      clause: LOOPS,
      mechanism: MECHANISM,
      location: repoPathSchema.parse("package.json"),
      script: "lint",
      option: "--no-inline-config",
      cause: { kind: "weakens-run" },
    },
    fills: { "package file": "package.json", script: "lint", option: "--no-inline-config" },
  },
  "after-another-command": {
    entry: {
      kind: "command-line-option",
      clause: LOOPS,
      mechanism: MECHANISM,
      location: repoPathSchema.parse("package.json"),
      script: "lint",
      option: "-c eslint.config.mjs",
      cause: { kind: "after-another-command", command: "eslint", invocation: SCRIPT_OPTION_INVOCATION },
    },
    fills: {
      "package file": "package.json",
      script: "lint",
      option: "-c eslint.config.mjs",
      command: "eslint",
      invocation: JSON.stringify(SCRIPT_OPTION_INVOCATION),
    },
  },
  wrapped: {
    entry: {
      kind: "command-line-option",
      clause: LOOPS,
      mechanism: MECHANISM,
      location: repoPathSchema.parse("package.json"),
      script: "lint",
      option: "--ignore-pattern legacy/**",
      cause: { kind: "wrapped", command: "eslint", wrapper: SCRIPT_OPTION_WRAPPER },
    },
    fills: {
      "package file": "package.json",
      script: "lint",
      option: "--ignore-pattern legacy/**",
      command: "eslint",
      wrapper: JSON.stringify(SCRIPT_OPTION_WRAPPER),
    },
  },
};

const NATIVE_EXCEPTIONS: {
  readonly [Kind in AttributedNativeException["kind"]]: readonly Filled<Extract<AttributedNativeException, { readonly kind: Kind }>>[];
} = {
  ignore: [{ entry: { kind: "ignore", clause: LOOPS, mechanism: MECHANISM, file: FILE }, fills: {} }],
  "config-override": [{ entry: { kind: "config-override", clause: LOOPS, mechanism: MECHANISM, file: FILE }, fills: {} }],
  "suppression-entry": [
    {
      entry: { kind: "suppression-entry", clause: LOOPS, mechanism: MECHANISM, file: FILE, location: repoPathSchema.parse("eslint-suppressions.json") },
      fills: { "suppressions file": "eslint-suppressions.json" },
    },
  ],
  "inline-disable": Object.values(INLINE_DISABLES),
  "inline-rule-config": [
    {
      entry: { kind: "inline-rule-config", clause: LOOPS, mechanism: MECHANISM, file: FILE, line: 1, text: "/* eslint no-x: off */" },
      fills: { line: "1", comment: "/* eslint no-x: off */" },
    },
  ],
  "command-line-option": Object.values(SCRIPT_OPTIONS),
};

const SINGLE_RECORDS_FILE = repoPathSchema.parse("discipline-exceptions.json");

const SPLIT_RECORDS_FOLDER = repoPathSchema.parse("discipline-exceptions");

const SPLIT_RECORDS_FILE = repoPathSchema.parse("discipline-exceptions/file-carve-outs/cd-15.json");

const RECORD_PROBLEMS: { readonly [Kind in InvalidRecord["problem"]["kind"]]: Filled<Extract<InvalidRecord["problem"], { readonly kind: Kind }>> } = {
  "clause-unparseable": { entry: { kind: "clause-unparseable", detail: "not a clause address" }, fills: { detail: "not a clause address" } },
  "clause-not-selected": { entry: { kind: "clause-not-selected", clause: LOOPS }, fills: {} },
  "clause-not-adopted": { entry: { kind: "clause-not-adopted", clause: LOOPS }, fills: {} },
  "clause-not-run": { entry: { kind: "clause-not-run", clause: LOOPS }, fills: {} },
  "file-not-repo-path": { entry: { kind: "file-not-repo-path", file: "../outside.ts" }, fills: { file: "../outside.ts" } },
  "why-chain-refused": { entry: { kind: "why-chain-refused", detail: "the chain stops at a symptom" }, fills: { detail: "the chain stops at a symptom" } },
  "evidence-refused": { entry: { kind: "evidence-refused", detail: "no evidence" }, fills: { detail: "no evidence" } },
  "import-unverified": { entry: { kind: "import-unverified", detail: "the source has no such entry" }, fills: { detail: "the source has no such entry" } },
  "non-exemptible-clause": { entry: { kind: "non-exemptible-clause", clause: LOOPS }, fills: {} },
  duplicate: { entry: { kind: "duplicate", of: { layout: "single-file", file: SINGLE_RECORDS_FILE, index: 0 } }, fills: { "earlier index": "0" } },
};

const SPLIT_RECORD_PROBLEMS: typeof RECORD_PROBLEMS = {
  ...RECORD_PROBLEMS,
  duplicate: {
    entry: { kind: "duplicate", of: { layout: "split", file: SPLIT_RECORDS_FILE, index: 0 } },
    fills: { "earlier records file": SPLIT_RECORDS_FILE, "earlier index": "0" },
  },
};

type MechanismNotRun = Extract<Unmeasured, { readonly kind: "mechanism-not-run" }>;

type BaseDependentKind = Extract<Unmeasured, { readonly base: BaseRevisionAvailability }>["kind"];

const UNRUN_PROJECTIONS: Readonly<Record<MechanismNotRun["projection"], MechanismNotRun>> = {
  missing: { kind: "mechanism-not-run", mechanism: MECHANISM, projection: "missing" },
  "not-included": { kind: "mechanism-not-run", mechanism: MECHANISM, projection: "not-included", nestedConfigurations: [] },
};

const NESTED_UNRUN: Filled<Unmeasured> = {
  entry: {
    kind: "mechanism-not-run",
    mechanism: MECHANISM,
    projection: "not-included",
    nestedConfigurations: [repoPathSchema.parse("packages/legacy"), repoPathSchema.parse("packages/tools")],
  },
  fills: { folders: "packages/legacy, packages/tools" },
};

const GIT_FAILED_BASE = { state: "git-failed", revision: "origin/main", gitMessage: "fatal: bad revision" } as const;

const baseSamplesOf = (request: {
  readonly kind: BaseDependentKind;
}): Readonly<Record<BaseRevisionAvailability["state"], Filled<Unmeasured>>> => ({
  "not-given": { entry: { kind: request.kind, base: { state: "not-given" } }, fills: {} },
  "git-failed": {
    entry: { kind: request.kind, base: GIT_FAILED_BASE },
    fills: { revision: JSON.stringify(GIT_FAILED_BASE.revision), "git message": JSON.stringify(GIT_FAILED_BASE.gitMessage) },
  },
});

const UNMEASURED: Readonly<Record<Unmeasured["kind"], readonly Filled<Unmeasured>[]>> = {
  "forfeiture-unmeasured": Object.values(baseSamplesOf({ kind: "forfeiture-unmeasured" })),
  "import-unmeasured": Object.values(baseSamplesOf({ kind: "import-unmeasured" })),
  "legacy-chain-unmeasured": Object.values(baseSamplesOf({ kind: "legacy-chain-unmeasured" })),
  "mechanism-not-run": [...Object.values(UNRUN_PROJECTIONS).map((entry) => ({ entry, fills: {} })), NESTED_UNRUN],
};

const UNSLICED_UNRUN: readonly Filled<Unmeasured>[] = [{ entry: UNRUN_PROJECTIONS["not-included"], fills: {} }, NESTED_UNRUN];

const SLICE = repoPathSchema.parse("packages/web/disciplines.eslint.mjs");

const PROJECTION_PROBLEMS: {
  readonly [Scope in ProjectionProblem["scope"]]: Readonly<
    Record<Extract<ProjectionProblem, { readonly scope: Scope }>["state"], ProjectionProblem>
  >;
} = {
  projection: { "out-of-date": { scope: "projection", mechanism: MECHANISM, state: "out-of-date" } },
  slice: {
    "out-of-date": { scope: "slice", mechanism: MECHANISM, state: "out-of-date", slice: SLICE },
    missing: { scope: "slice", mechanism: MECHANISM, state: "missing", slice: SLICE },
    "not-applied": { scope: "slice", mechanism: MECHANISM, state: "not-applied", slice: SLICE },
    unconfigured: { scope: "slice", mechanism: MECHANISM, state: "unconfigured", slice: SLICE },
  },
};

const ONE_CARVE_OUT_ELSEWHERE: PartialAssessment = { concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 1 };

const PARTIAL_ASSESSMENTS: {
  readonly [Concern in PartialAssessment["concern"]]: Readonly<Record<PartialAssessment["assessedBy"], readonly Filled<PartialAssessment>[]>>;
} = {
  forfeiture: {
    elsewhere: [
      { entry: ONE_CARVE_OUT_ELSEWHERE, fills: {} },
      { entry: { concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 37 }, fills: { count: "37" } },
    ],
  },
};

const readingOf = (request: { readonly assessmentSection: AssessmentSection; readonly presence: FilePresence }): ClauseReading => ({
  kind: "clause",
  clause: LOOPS,
  assessmentSection: request.assessmentSection,
  rulePage: { path: RULE_PAGE, presence: request.presence },
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
  "not-written": { kind: "assessment-file", state: "not-written", guide: ADOPTION_GUIDE },
  unreadable: { kind: "assessment-file", state: "unreadable", guide: ADOPTION_GUIDE },
};

const SLICE_FOLDER = "packages/web";

const projectionFillsOf = (request: { readonly problem: ProjectionProblem }): Fills =>
  request.problem.scope === "slice" ? { slice: request.problem.slice, folder: SLICE_FOLDER } : {};

const unfilled = <Entry>(entries: readonly Entry[]): readonly Filled<Entry>[] => entries.map((entry) => ({ entry, fills: {} }));

const SECTION_SAMPLES: SectionSamples = {
  excluded: [{ entry: repoPathSchema.parse("generated"), fills: { path: "generated" } }],
  notAdopted: unfilled([LOOPS]),
  notRun: unfilled([LOOPS]),
  editions: [{ entry: EDITION_READING, fills: { edition: "1", latest: "2" } }],
  findings: unfilled([FINDING]),
  exempted: [
    ...Object.values(RECORDS).map((record) => ({ entry: { finding: FINDING, by: [record] }, fills: { "record kind": record.kind } })),
    ...Object.values(IMPORTED_RECORDS).map((imported) => ({ entry: { finding: FINDING, by: [imported.entry] }, fills: imported.fills })),
  ],
  uncovered: unfilled([LOOPS]),
  stale: unfilled(Object.values(RECORDS)),
  forfeited: unfilled([RECORDS["file-carve-out"]]),
  unrecorded: Object.values(NATIVE_EXCEPTIONS).flat(),
  doublyHeld: unfilled([{ clause: LOOPS, file: FILE, mechanism: MECHANISM }]),
  invalidRecords: [
    ...Object.values(RECORD_PROBLEMS).map((problem, index) => ({
      entry: { place: { layout: "single-file" as const, file: SINGLE_RECORDS_FILE, index }, problem: problem.entry },
      fills: { ...problem.fills, index: String(index) },
    })),
    ...Object.values(SPLIT_RECORD_PROBLEMS).map((problem, index) => ({
      entry: { place: { layout: "split" as const, file: SPLIT_RECORDS_FILE, index }, problem: problem.entry },
      fills: { ...problem.fills, index: String(index), "records file": SPLIT_RECORDS_FILE },
    })),
  ],
  unmeasured: Object.values(UNMEASURED).flat(),
  projectionProblems: Object.values(PROJECTION_PROBLEMS)
    .flatMap((byState) => Object.values(byState))
    .map((problem) => ({ entry: problem, fills: projectionFillsOf({ problem }) })),
  assessment: Object.values(PARTIAL_ASSESSMENTS).flatMap((byAssessor) => Object.values(byAssessor).flat()),
  readFirst: unfilled(Object.values(READINGS).flatMap((byPresence) => Object.values(byPresence))),
};

const EMPTY_REPORT: CheckReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
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

const entriesOf = <Entry>(samples: readonly Filled<Entry>[]): readonly Entry[] => samples.map((sample) => sample.entry);

const EVERY_ENTRY: CheckReport = {
  excluded: entriesOf(SECTION_SAMPLES.excluded),
  notAdopted: entriesOf(SECTION_SAMPLES.notAdopted),
  notRun: entriesOf(SECTION_SAMPLES.notRun),
  editions: entriesOf(SECTION_SAMPLES.editions),
  findings: entriesOf(SECTION_SAMPLES.findings),
  exempted: entriesOf(SECTION_SAMPLES.exempted),
  uncovered: entriesOf(SECTION_SAMPLES.uncovered),
  stale: entriesOf(SECTION_SAMPLES.stale),
  forfeited: entriesOf(SECTION_SAMPLES.forfeited),
  unrecorded: entriesOf(SECTION_SAMPLES.unrecorded),
  doublyHeld: entriesOf(SECTION_SAMPLES.doublyHeld),
  invalidRecords: entriesOf(SECTION_SAMPLES.invalidRecords),
  unmeasured: entriesOf(SECTION_SAMPLES.unmeasured),
  projectionProblems: entriesOf(SECTION_SAMPLES.projectionProblems),
  assessment: entriesOf(SECTION_SAMPLES.assessment),
  readFirst: entriesOf(SECTION_SAMPLES.readFirst),
};

const sampleFills: EntryFills = ({ section, position }) => ({ ...SHARED_FILLS, ...SECTION_SAMPLES[section][position]?.fills });

const sharedFills: EntryFills = () => SHARED_FILLS;

const unslicedFills: EntryFills = ({ position }) => ({ ...SHARED_FILLS, ...UNSLICED_UNRUN[position]?.fills });

const NOTED_REPORTS: readonly CheckReport[] = Object.values(NOTES).flatMap((note) => [
  { ...EMPTY_REPORT, findings: [FINDING], readFirst: [note, READINGS.unread.present] },
  { ...EMPTY_REPORT, findings: [FINDING], readFirst: [note, READINGS.unread.absent] },
]);

const VERDICT_REPORTS: Readonly<Record<Verdict, Readonly<Record<"whole" | "partial", CheckReport>>>> = {
  pass: { whole: EMPTY_REPORT, partial: { ...EMPTY_REPORT, assessment: [ONE_CARVE_OUT_ELSEWHERE] } },
  fail: { whole: { ...EMPTY_REPORT, findings: [FINDING] }, partial: { ...EMPTY_REPORT, findings: [FINDING], assessment: [ONE_CARVE_OUT_ELSEWHERE] } },
};

const EVERY_OUTPUT: readonly ReportOutput[] = reportOutputSchema.options;

const REPORT_LINES: readonly PrintedLine[] = [
  ...EVERY_OUTPUT.flatMap((output) => reportLinesOf({ report: EVERY_ENTRY, output, projectCommand: PROJECT_COMMAND, entryFills: sampleFills })),
  ...reportLinesOf({
    report: { ...EMPTY_REPORT, unmeasured: entriesOf(UNSLICED_UNRUN) },
    output: "full",
    projectCommand: PROJECT_COMMAND,
    entryFills: unslicedFills,
  }),
  ...[...NOTED_REPORTS, ...Object.values(VERDICT_REPORTS).flatMap((byPart) => Object.values(byPart))].flatMap((report) =>
    reportLinesOf({ report, output: "full", projectCommand: PROJECT_COMMAND, entryFills: sharedFills }),
  ),
];

const PEER = { packageName: "eslint", peer: "required", supported: "^9.0.0 || ^10.0.0", found: "8.57.0" } as const;

const PEER_FILLS: Fills = { package: "eslint", "version found": "8.57.0", range: "^9.0.0 || ^10.0.0" };

const RUNNER_FAILURES: { readonly [Kind in RunnerFailure["kind"]]: Filled<Extract<RunnerFailure, { readonly kind: Kind }>> } = {
  "piece-invalid": {
    entry: { kind: "piece-invalid", pieceRoot: "node_modules/@hailstails/hone/mechanisms/eslint/CD-1", detail: "no module" },
    fills: { "piece folder": "node_modules/@hailstails/hone/mechanisms/eslint/CD-1", detail: "no module" },
  },
  "file-unreadable": { entry: { kind: "file-unreadable", file: FILE, detail: "EACCES" }, fills: { detail: "EACCES" } },
  "file-unparseable": { entry: { kind: "file-unparseable", file: FILE, detail: "unexpected token" }, fills: { detail: "unexpected token" } },
  "tool-failed": { entry: { kind: "tool-failed", detail: "eslint exited 2" }, fills: { detail: "eslint exited 2" } },
  "plugin-conflict": { entry: { kind: "plugin-conflict", detail: "two copies of the plugin" }, fills: { detail: "two copies of the plugin" } },
  "team-config-unloadable": { entry: { kind: "team-config-unloadable", detail: "eslint.config.mjs threw" }, fills: { detail: "eslint.config.mjs threw" } },
  "runner-invalid-output": { entry: { kind: "runner-invalid-output", detail: "not an array" }, fills: { detail: "not an array" } },
  "toolchain-unavailable": { entry: { kind: "toolchain-unavailable", peers: [PEER] }, fills: PEER_FILLS },
  "toolchain-shadowed": {
    entry: {
      kind: "toolchain-shadowed",
      packageName: "eslint",
      location: "node_modules/@hailstails/hone/node_modules/eslint",
      installRoot: "node_modules/@hailstails/hone",
    },
    fills: { package: "eslint", location: "node_modules/@hailstails/hone/node_modules/eslint", "install folder": "node_modules/@hailstails/hone" },
  },
};

const UNAVAILABLE_TOOLCHAINS: readonly Filled<RunnerFailure>[] = [
  { entry: { kind: "toolchain-unavailable", peers: [{ ...PEER, found: "not installed" }] }, fills: PEER_FILLS },
  {
    entry: { kind: "toolchain-unavailable", peers: [PEER, { ...PEER, packageName: "typescript-eslint" }] },
    fills: { ...PEER_FILLS, "other package": "typescript-eslint" },
  },
];

const LOAD_FAILURES: { readonly [Kind in LoadFailure["kind"]]: Filled<Extract<LoadFailure, { readonly kind: Kind }>> } = {
  "arguments-invalid": { entry: { kind: "arguments-invalid", detail: "--repo needs a value" }, fills: { detail: "--repo needs a value" } },
  "install-root-unresolvable": {
    entry: { kind: "install-root-unresolvable", url: "https://example.invalid/tool.js", detail: "not a file URL" },
    fills: { url: "https://example.invalid/tool.js", detail: "not a file URL" },
  },
  "file-unreadable": { entry: { kind: "file-unreadable", path: "disciplines.json", detail: "EACCES" }, fills: { path: "disciplines.json", detail: "EACCES" } },
  "file-malformed": {
    entry: { kind: "file-malformed", path: "disciplines.json", detail: "clauses is not an object" },
    fills: { path: "disciplines.json", detail: "clauses is not an object" },
  },
  "file-unwritable": {
    entry: { kind: "file-unwritable", path: "discipline-exceptions.json", detail: "EACCES" },
    fills: { path: "discipline-exceptions.json", detail: "EACCES" },
  },
  "why-chains-required": { entry: { kind: "why-chains-required", path: "disciplines.json" }, fills: { path: "disciplines.json" } },
  "records-in-both-layouts": {
    entry: { kind: "records-in-both-layouts", path: "discipline-exceptions.json", folder: "discipline-exceptions" },
    fills: { path: "discipline-exceptions.json", "records folder": "discipline-exceptions" },
  },
  "records-unsplittable": {
    entry: { kind: "records-unsplittable", path: "discipline-exceptions.json", detail: "exceptions[3] has the clause \"CD-15 loops\", which names no discipline" },
    fills: { path: "discipline-exceptions.json", detail: "exceptions[3] has the clause \"CD-15 loops\", which names no discipline" },
  },
  "unsupported-version": { entry: { kind: "unsupported-version", path: "disciplines.json", found: 2 }, fills: { path: "disciplines.json", "version found": "2" } },
  "reserved-rule-set-name": { entry: { kind: "reserved-rule-set-name", name: "hone" }, fills: { "rule set": "hone" } },
  "rule-set-name-collision": { entry: { kind: "rule-set-name-collision", name: "team", other: "team-web" }, fills: { "rule set": "team", "other rule set": "team-web" } },
  "duplicate-clause": {
    entry: { kind: "duplicate-clause", address: "CD-15#loops", prefixedAddress: "hone/CD-15#loops" },
    fills: { "clause with its rule set": "hone/CD-15#loops" },
  },
  "unknown-rule-set": { entry: { kind: "unknown-rule-set", name: "team" }, fills: { "rule set": "team" } },
  "unknown-discipline": { entry: { kind: "unknown-discipline", address: "CD-99#loops" }, fills: { clause: "CD-99#loops" } },
  "unknown-clause": { entry: { kind: "unknown-clause", address: "CD-15#whiles" }, fills: { clause: "CD-15#whiles" } },
  "judgement-clause-selected": { entry: { kind: "judgement-clause-selected", address: "CD-3#names" }, fills: { clause: "CD-3#names" } },
  "judgement-clause-listed": { entry: { kind: "judgement-clause-listed", address: "CD-3#names" }, fills: { clause: "CD-3#names" } },
  "mechanism-not-allowed": { entry: { kind: "mechanism-not-allowed", address: "CD-15#loops", mechanism: MECHANISM }, fills: {} },
  "runner-missing": { entry: { kind: "runner-missing", mechanism: MECHANISM }, fills: {} },
  "runner-invalid": { entry: { kind: "runner-invalid", mechanism: MECHANISM, detail: "no runner export" }, fills: { detail: "no runner export" } },
  "piece-missing": { entry: { kind: "piece-missing", address: "CD-15#loops", mechanism: MECHANISM }, fills: {} },
  "rule-set-invalid": {
    entry: { kind: "rule-set-invalid", path: "team/rules/TM-1/discipline.json", detail: "no clauses" },
    fills: { path: "team/rules/TM-1/discipline.json", detail: "no clauses" },
  },
  "git-failed": { entry: { kind: "git-failed", detail: "not a git repository" }, fills: { detail: "not a git repository" } },
  "config-root-untracked": { entry: { kind: "config-root-untracked", root: repoPathSchema.parse("packages/gone") }, fills: { "config root": "packages/gone" } },
  "selection-absent": { entry: { kind: "selection-absent", repo: "src" }, fills: { dir: "src" } },
  "unexpected-error": {
    entry: { kind: "unexpected-error", detail: "Cannot read properties of undefined" },
    fills: { detail: "Cannot read properties of undefined" },
  },
  "runner-failed": { entry: { kind: "runner-failed", mechanism: MECHANISM, failure: RUNNER_FAILURES["tool-failed"].entry }, fills: RUNNER_FAILURES["tool-failed"].fills },
};

const ARGUMENT_PROBLEMS: { readonly [Kind in ArgumentProblem["kind"]]: Filled<Extract<ArgumentProblem, { readonly kind: Kind }>> } = {
  "command-missing": { entry: { kind: "command-missing" }, fills: {} },
  "command-unknown": { entry: { kind: "command-unknown", given: "lint" }, fills: { given: "lint" } },
  "flag-extra": { entry: { kind: "flag-extra", flag: "--version", given: "extra" }, fills: { flag: "--version", given: "extra" } },
  "argument-unexpected": {
    entry: { kind: "argument-unexpected", subcommand: "check", given: "src" },
    fills: { command: "check", given: "src", option: "--repo", value: "<dir>" },
  },
  "option-unknown": { entry: { kind: "option-unknown", subcommand: "project", given: "--fix" }, fills: { command: "project", given: "--fix" } },
  "option-joined": { entry: { kind: "option-joined", option: REPO_OPTION, given: "--repo=src" }, fills: { option: "--repo", value: "<dir>", given: "--repo=src" } },
  "value-missing": { entry: { kind: "value-missing", option: REPO_OPTION }, fills: { option: "--repo", value: "<dir>" } },
  "option-repeated": { entry: { kind: "option-repeated", option: FORFEITURE_OPTION }, fills: { option: "--forfeiture" } },
  "option-required": { entry: { kind: "option-required", subcommand: "check", option: REPO_OPTION }, fills: { command: "check" } },
  "choice-invalid": {
    entry: { kind: "choice-invalid", option: FORFEITURE_OPTION, choices: ["this-run", "elsewhere"], given: "later" },
    fills: { option: "--forfeiture", values: "this-run or elsewhere", given: "later" },
  },
  "option-removed": { entry: { kind: "option-removed", given: "--waived-clauses", instead: WAIVED_CLAUSES_REPLACEMENT }, fills: {} },
  "repo-unresolvable": { entry: { kind: "repo-unresolvable", given: "src" }, fills: { dir: "src" } },
  "path-invalid": { entry: { kind: "path-invalid", option: LEAVE_OPTION, given: "src/*.ts" }, fills: { option: "--leave", given: "src/*.ts" } },
};

const failureLine = (request: { readonly label: string; readonly failure: LoadFailure; readonly fills: Fills }): PrintedLine => ({
  label: request.label,
  text: loadFailureText(request).trimEnd(),
  fills: { ...SHARED_FILLS, ...request.fills },
});

const FAILURE_LINES: readonly PrintedLine[] = [
  ...Object.values(LOAD_FAILURES).map((sample) => failureLine({ label: sample.entry.kind, failure: sample.entry, fills: sample.fills })),
  ...[...Object.values(RUNNER_FAILURES), ...UNAVAILABLE_TOOLCHAINS].map((sample) =>
    failureLine({ label: "runner-failed", failure: { kind: "runner-failed", mechanism: MECHANISM, failure: sample.entry }, fills: sample.fills }),
  ),
  ...Object.values(ARGUMENT_PROBLEMS).map((sample) =>
    failureLine({ label: sample.entry.kind, failure: argumentsInvalid({ problem: sample.entry }).error, fills: sample.fills }),
  ),
];

const PROJECTION_EFFECTS: Readonly<Record<ProjectionWrite["effect"], ProjectionWrite>> = {
  written: { path: repoPathSchema.parse("disciplines.eslint.mjs"), effect: "written" },
  unchanged: { path: repoPathSchema.parse("disciplines.eslint.mjs"), effect: "unchanged" },
  removed: { path: repoPathSchema.parse("disciplines.eslint.mjs"), effect: "removed" },
  "left-in-place": { path: repoPathSchema.parse("disciplines.eslint.mjs"), effect: "left-in-place" },
};

const linesOf = (request: { readonly label: string; readonly text: string; readonly fills: Fills }): readonly PrintedLine[] =>
  request.text
    .trimEnd()
    .split("\n")
    .map((text) => ({ label: request.label, text, fills: request.fills }));

const PROJECT_LINES: readonly PrintedLine[] = linesOf({
  label: "project",
  text: projectCommandOutcome({ result: { outcome: "ok", value: Object.values(PROJECTION_EFFECTS) } }).text,
  fills: { path: "disciplines.eslint.mjs" },
});

const LEFT_UNDER = repoPathSchema.parse("src");

const INHERITED_DEBT_EFFECTS: Readonly<Record<InheritedDebtOutcome["effect"], InheritedDebtOutcome>> = {
  recorded: { clause: LOOPS, file: FILE, effect: "recorded" },
  "already-recorded": { clause: LOOPS, file: FILE, effect: "already-recorded", heldIn: SPLIT_RECORDS_FILE },
  left: { clause: LOOPS, file: FILE, effect: "left", under: LEFT_UNDER },
  "new-file": { clause: LOOPS, file: FILE, effect: "new-file" },
  refused: { clause: LOOPS, file: FILE, effect: "refused" },
};

const RECORD_DEBT_LINES: readonly PrintedLine[] = linesOf({
  label: "record-debt",
  text: recordDebtCommandOutcome({ result: { outcome: "ok", value: Object.values(INHERITED_DEBT_EFFECTS) } }).text,
  fills: { clause: "CD-15#loops", file: "src/basket.ts", path: "src", "records file": SPLIT_RECORDS_FILE },
});

const SPLIT_RECORDS_OUTCOMES: readonly { readonly split: RecordsSplit; readonly path: string }[] = [
  { split: { effect: "split", writes: [{ path: SPLIT_RECORDS_FILE, effect: "written" }] }, path: SPLIT_RECORDS_FILE },
  { split: { effect: "split", writes: [{ path: SINGLE_RECORDS_FILE, effect: "removed" }] }, path: SINGLE_RECORDS_FILE },
  { split: { effect: "already-split", path: SPLIT_RECORDS_FOLDER }, path: SPLIT_RECORDS_FOLDER },
  { split: { effect: "no-records", path: SINGLE_RECORDS_FILE }, path: SINGLE_RECORDS_FILE },
];

const SPLIT_RECORDS_LINES: readonly PrintedLine[] = SPLIT_RECORDS_OUTCOMES.flatMap(({ split, path }) =>
  linesOf({ label: "split-records", text: splitRecordsCommandOutcome({ result: { outcome: "ok", value: split } }).text, fills: { path } }),
);

const VERSION_MANIFEST: FileTextPort = {
  read: () => ({ outcome: "ok", value: JSON.stringify({ name: "@hailstails/hone", version: "1.0.0" }) }),
  exists: () => "present",
  write: () => ({ outcome: "ok", value: undefined }),
};

const VERSION_LINES: readonly PrintedLine[] = linesOf({
  label: "version",
  text: versionCommandOutcome({
    result: installedVersionOf({
      fileText: VERSION_MANIFEST,
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      moduleUrl: "file:///install/core/check/tool-command.ts",
    }),
  }).text,
  fills: { version: "1.0.0" },
});

export const PRINTABLE_LINES: readonly PrintedLine[] = [
  ...REPORT_LINES,
  ...FAILURE_LINES,
  ...PROJECT_LINES,
  ...RECORD_DEBT_LINES,
  ...SPLIT_RECORDS_LINES,
  ...VERSION_LINES,
];

export const PRINTED_SECTION_ROLES: readonly DocumentedRole[] = SECTION_NAMES.map((section) => ({ section, role: sectionRoleOf({ section }) }));

const HELP_TOPICS: readonly HelpTopic[] = ["tool", ...SUBCOMMANDS];

const FENCE = "```";

export const PRINTED_BLOCKS: readonly string[] = [SYNOPSIS, ...HELP_TOPICS.map((topic) => helpText({ topic }))].map(
  (text) => `${FENCE}text\n${text}${FENCE}`,
);
