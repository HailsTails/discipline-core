import type { LoadFailure } from "../core/command-line/load-failure.ts";
import { loadFailureDetail } from "../core/command-line/load-failure-text.ts";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import { ALREADY_ON_VERSION_TWO, upgradeSuccessOutcomeOf } from "../core/upgrade/command/upgrade-success-text.ts";
import { type UpgradeFailure, UPGRADE_ISSUES_URL, upgradeFailureOutcomeOf } from "../core/upgrade/command/upgrade-refusal-text.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { mechanismIdSchema } from "../core/values/identifiers.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import type { Fills, PrintedLine } from "./output-contract.ts";

const REPO = absolutePathSchema.parse("/repo");

const SETTINGS = absolutePathSchema.parse("/repo/hone.config.json");

const OLD_FILE = absolutePathSchema.parse("/repo/disciplines.eslint.mjs");

const CLAUSE = "CD-15#loops";

const FILE = repoPathSchema.parse("src/a.ts");

const MECHANISM = mechanismIdSchema.parse("eslint");

const CONFIG = repoPathSchema.parse("eslint.config.mjs");

const PROJECTION = repoPathSchema.parse("disciplines.eslint.mjs");

const UNREADABLE: LoadFailure = { kind: "git-failed", detail: "git ls-files: not a git repository" };

type Sample = { readonly failure: UpgradeFailure; readonly fills: Fills };

const BASE_FILLS: Fills = { "issues page": UPGRADE_ISSUES_URL, clause: CLAUSE, file: FILE, "config file": CONFIG, projection: PROJECTION, detail: "the detail", path: SETTINGS };

const SAMPLES: readonly Sample[] = [
  { failure: { kind: "oracle-failed", failure: { kind: "version-one-run-failed", detail: "the detail" } }, fills: {} },
  { failure: { kind: "oracle-failed", failure: { kind: "finding-not-attributable", clause: CLAUSE, file: FILE, check: undefined } }, fills: {} },
  { failure: { kind: "oracle-failed", failure: { kind: "record-doubly-held", clause: CLAUSE, file: FILE } }, fills: {} },
  { failure: { kind: "plan-refused", refusal: { kind: "carve-out-unanswered", clause: CLAUSE, file: FILE } }, fills: {} },
  {
    failure: {
      kind: "plan-refused",
      refusal: {
        kind: "mapping-refused",
        refusals: [
          { kind: "eslint-config-roots", roots: [repoPathSchema.parse("packages/a"), repoPathSchema.parse("packages/b")] },
          { kind: "clause-without-check", clause: CLAUSE },
          { kind: "no-engine-on-mechanism", check: "loop-keyword#loops", mechanism: MECHANISM },
          { kind: "two-engines-on-mechanism", check: "loop-keyword#loops", mechanism: MECHANISM, engines: ["eslint", "oxlint"] },
          { kind: "record-answers-nothing", clause: CLAUSE, file: FILE, credited: "nothing" },
          { kind: "record-answers-nothing", clause: CLAUSE, file: FILE, credited: "suppression-only" },
          { kind: "clause-wide-carve-out", clause: CLAUSE },
          { kind: "records-name-refused", name: "Not A Name" },
        ],
      },
    },
    fills: { roots: "packages/a, packages/b", check: "loop-keyword#loops", mechanism: "eslint", engines: "eslint or oxlint", name: "Not A Name" },
  },
  { failure: { kind: "plan-refused", refusal: { kind: "projection-failed", detail: "the detail" } }, fills: {} },
  { failure: { kind: "plan-refused", refusal: { kind: "projection-not-single", files: [] } }, fills: { count: "0" } },
  { failure: { kind: "plan-refused", refusal: { kind: "reach-beyond-entries", records: [{ symptom: "loop-keyword#loops", file: "src/b.ts" }] } }, fills: { records: "loop-keyword#loops in src/b.ts" } },
  { failure: { kind: "plan-refused", refusal: { kind: "config-import-refused", refusal: { kind: "no-projection-import", file: CONFIG } } }, fills: {} },
  { failure: { kind: "plan-refused", refusal: { kind: "config-import-refused", refusal: { kind: "several-projection-imports", file: CONFIG, count: 2 } } }, fills: { count: "2" } },
  { failure: { kind: "plan-refused", refusal: { kind: "config-import-refused", refusal: { kind: "projection-named-elsewhere", file: CONFIG } } }, fills: {} },
  { failure: { kind: "version-one-run-failed", failure: { kind: "run-failed", detail: "the detail" } }, fills: {} },
  { failure: { kind: "unplaceable-path", file: FILE }, fills: {} },
  { failure: { kind: "removal-refused", failure: { kind: "records-file-outside-root", path: OLD_FILE, root: REPO } }, fills: { root: REPO, path: OLD_FILE } },
  { failure: { kind: "write-refused", refusal: { failure: { kind: "path-already-exists", path: SETTINGS }, unrestored: [] } }, fills: {} },
  { failure: { kind: "write-refused", refusal: { failure: { kind: "replaced-file-unreadable", path: SETTINGS, detail: "the detail" }, unrestored: [] } }, fills: {} },
  { failure: { kind: "write-refused", refusal: { failure: { kind: "directory-uncreatable", path: SETTINGS, detail: "the detail" }, unrestored: [] } }, fills: {} },
  {
    failure: { kind: "write-refused", refusal: { failure: { kind: "unwritable", path: SETTINGS, detail: "the detail" }, unrestored: [{ path: OLD_FILE, detail: "EBUSY" }] } },
    fills: { "unrestored path": OLD_FILE, "unrestored detail": "EBUSY" },
  },
  { failure: { kind: "version-two-run-failed", failure: { kind: "run-failed", detail: "the detail" }, unrestored: [] }, fills: {} },
  {
    failure: {
      kind: "differences",
      differences: [{ section: "findings", onlyBefore: ["CD-15#loops src/a.ts 3:1"], onlyAfter: ["CD-15#loops src/a.ts 4:1"] }],
      unrestored: [],
    },
    fills: { section: "findings", before: "CD-15#loops src/a.ts 3:1", after: "CD-15#loops src/a.ts 4:1" },
  },
  {
    failure: {
      kind: "records-refused",
      refusal: { kind: "invalid-records", invalid: [{ place: { layout: "split", file: repoPathSchema.parse("discipline-exceptions/file-carve-outs/cd-15.json"), index: 1 }, problem: { kind: "clause-unparseable", detail: "the detail" } }] },
    },
    fills: { "records file": "discipline-exceptions/file-carve-outs/cd-15.json", index: "1", problem: "clause-unparseable" },
  },
  {
    failure: { kind: "records-refused", refusal: { kind: "entry-not-json", place: { layout: "single-file", file: repoPathSchema.parse("discipline-exceptions.json"), index: 0 } } },
    fills: { "records file": "discipline-exceptions.json" },
  },
  { failure: { kind: "version-one-unreadable", failure: UNREADABLE }, fills: { detail: loadFailureDetail({ failure: UNREADABLE }) } },
  { failure: { kind: "several-version-one-projections", projections: [PROJECTION, repoPathSchema.parse("disciplines.other.mjs")] }, fills: { projections: "disciplines.eslint.mjs, disciplines.other.mjs" } },
  { failure: { kind: "team-config-refused", refusal: { kind: "no-file-imports-projection", projection: PROJECTION } }, fills: {} },
  {
    failure: { kind: "team-config-refused", refusal: { kind: "several-files-import-projection", projection: PROJECTION, files: [repoPathSchema.parse("a.config.mjs"), repoPathSchema.parse("b.config.mjs")] } },
    fills: { files: "a.config.mjs, b.config.mjs" },
  },
  { failure: { kind: "team-config-refused", refusal: { kind: "config-candidate-unreadable", file: CONFIG, detail: "the detail" } }, fills: {} },
  {
    failure: {
      kind: "removal-failed",
      failure: { kind: "unremovable", path: OLD_FILE, detail: "the detail", removed: { files: [], folders: [] } },
      written: [repoPathSchema.parse("hone.config.json"), repoPathSchema.parse("hone.eslint.mjs")],
      replaced: CONFIG,
    },
    fills: { written: "hone.config.json, hone.eslint.mjs", replaced: "eslint.config.mjs", "removal path": OLD_FILE },
  },
  {
    failure: {
      kind: "removal-failed",
      failure: { kind: "records-file-outside-root", path: OLD_FILE, root: REPO },
      written: [repoPathSchema.parse("hone.config.json")],
      replaced: undefined,
    },
    fills: { written: "hone.config.json", "removal path": OLD_FILE, root: REPO },
  },
];

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const linesOf = (request: { readonly text: string; readonly fills: Fills }): readonly PrintedLine[] =>
  request.text
    .trimEnd()
    .split("\n")
    .map((text) => ({ label: "upgrade", text, fills: request.fills }));

const SUCCESS_TEXT = upgradeSuccessOutcomeOf({
  repoRoot: REPO,
  path: PATH,
  carried: {
    written: [repoPathSchema.parse("hone.config.json")],
    replaced: CONFIG,
    removed: { files: [absolutePathSchema.parse("/repo/disciplines.json")], folders: [absolutePathSchema.parse("/repo/discipline-exceptions")] },
  },
}).text;

export const UPGRADE_LINES: readonly PrintedLine[] = [
  ...SAMPLES.flatMap(({ failure, fills }) => linesOf({ text: upgradeFailureOutcomeOf({ failure }).text, fills: { ...BASE_FILLS, ...fills } })),
  ...SUCCESS_TEXT.trimEnd()
    .split("\n")
    .map((text): PrintedLine => ({ label: "upgrade", text, fills: { path: text.slice(text.indexOf(" ") + 1) } })),
  ...linesOf({ text: ALREADY_ON_VERSION_TWO.text, fills: {} }),
];
