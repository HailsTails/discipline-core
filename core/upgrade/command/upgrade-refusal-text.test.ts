import { describe, expect, it } from "vitest";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import { type UpgradeFailure, type UpgradeFailureOutcome, upgradeFailureOutcomeOf } from "./upgrade-refusal-text.ts";

const ISSUES = "https://github.com/HailsTails/hone/issues";

const FAULT = `This is a fault in hone, not in your repository. Report it at ${ISSUES}, with this output.`;

const SETTINGS = absolutePathSchema.parse("/repo/hone.config.json");

const OLD_FILE = absolutePathSchema.parse("/repo/disciplines.eslint.mjs");

const RECORDS_FOLDER = absolutePathSchema.parse("/repo/hone-records");

const OLD_SETTINGS = absolutePathSchema.parse("/repo/disciplines.json");

type Row = { readonly name: string; readonly failure: UpgradeFailure; readonly outcome: UpgradeFailureOutcome };

const ROWS: readonly Row[] = [
  {
    name: "the version 1 run cannot be made for the oracle",
    failure: { kind: "oracle-failed", failure: { kind: "version-one-run-failed", detail: "eslint not run: its projection is missing" } },
    outcome: {
      code: 1,
      text: "upgrade refused:\nversion 1's own run could not be made (eslint not run: its projection is missing). Run hone check and fix its load failure first.\nNothing was changed.\n",
    },
  },
  {
    name: "a carve-out is held twice",
    failure: { kind: "oracle-failed", failure: { kind: "record-doubly-held", clause: "CD-14#class-syntax", file: repoPathSchema.parse("src/a.ts") } },
    outcome: {
      code: 1,
      text: "upgrade refused:\nCD-14#class-syntax in src/a.ts is held by both a file carve-out and an authorised location. Remove one of them first, then run the upgrade again.\nNothing was changed.\n",
    },
  },
  {
    name: "a carve-out answers nothing",
    failure: {
      kind: "plan-refused",
      refusal: { kind: "mapping-refused", refusals: [{ kind: "record-answers-nothing", clause: "CD-15#loops", file: repoPathSchema.parse("src/a.ts"), credited: "nothing" }] },
    },
    outcome: {
      code: 1,
      text: "upgrade refused:\nthe file carve-out for CD-15#loops in src/a.ts answers no finding. Remove it, or fix the file it names, then run the upgrade again.\nNothing was changed.\n",
    },
  },
  {
    name: "version 2's projection cannot be made",
    failure: { kind: "plan-refused", refusal: { kind: "projection-failed", detail: "eslint missing" } },
    outcome: { code: 1, text: "upgrade refused:\nversion 2's projection could not be made (eslint missing). Fix what it names, then run the upgrade again.\nNothing was changed.\n" },
  },
  {
    name: "version 2 projects no single file for the team config",
    failure: { kind: "plan-refused", refusal: { kind: "projection-not-single", files: [] } },
    outcome: { code: 1, text: `upgrade refused:\nversion 2 projected 0 files, and the team config can import exactly one. ${FAULT}\nNothing was changed.\n` },
  },
  {
    name: "the team config's import is not static",
    failure: { kind: "plan-refused", refusal: { kind: "config-import-refused", refusal: { kind: "no-projection-import", file: repoPathSchema.parse("eslint.config.mjs"), projection: repoPathSchema.parse("disciplines.eslint.mjs") } } },
    outcome: {
      code: 1,
      text: 'upgrade refused:\neslint.config.mjs holds no static default import of disciplines.eslint.mjs. Change its import of it to the form import projection from "./disciplines.eslint.mjs", then run the upgrade again.\nNothing was changed.\n',
    },
  },
  {
    name: "the written records would reach beyond the entries",
    failure: { kind: "plan-refused", refusal: { kind: "reach-beyond-entries", records: [{ symptom: "loop-keyword#loops", file: "src/b.ts" }] } },
    outcome: {
      code: 1,
      text: `upgrade refused:\nthe version 2 records would reach beyond the version 1 entries: loop-keyword#loops in src/b.ts.\n${FAULT}\nNothing was changed.\n`,
    },
  },
  {
    name: "no file imports the version 1 projection",
    failure: { kind: "team-config-refused", refusal: { kind: "no-file-imports-projection", projection: repoPathSchema.parse("disciplines.eslint.mjs") } },
    outcome: {
      code: 1,
      text: 'upgrade refused:\nno file imports disciplines.eslint.mjs with a static default import. Change your ESLint config to import it in the form import projection from "./disciplines.eslint.mjs", then run the upgrade again.\nNothing was changed.\n',
    },
  },
  {
    name: "several files import the version 1 projection",
    failure: {
      kind: "team-config-refused",
      refusal: { kind: "several-files-import-projection", projection: repoPathSchema.parse("disciplines.eslint.mjs"), files: [repoPathSchema.parse("a.config.mjs"), repoPathSchema.parse("b.config.mjs")] },
    },
    outcome: {
      code: 1,
      text: "upgrade refused:\nseveral files import disciplines.eslint.mjs: a.config.mjs, b.config.mjs. Leave one importing it.\nNothing was changed.\n",
    },
  },
  {
    name: "two version 1 projections are present",
    failure: { kind: "several-version-one-projections", projections: [repoPathSchema.parse("disciplines.eslint.mjs"), repoPathSchema.parse("disciplines.other.mjs")] },
    outcome: {
      code: 1,
      text: "upgrade refused:\nseveral version 1 projections are present: disciplines.eslint.mjs, disciplines.other.mjs. The upgrade carries one; stay on version 1 until it carries several.\nNothing was changed.\n",
    },
  },
  {
    name: "a version 2 file already exists",
    failure: { kind: "write-refused", refusal: { failure: { kind: "path-already-exists", path: SETTINGS }, unrestored: [] } },
    outcome: { code: 1, text: "upgrade refused:\n/repo/hone.config.json already exists. Move it aside, then run the upgrade again.\nNothing was changed.\n" },
  },
  {
    name: "the version 2 run fails and a file cannot be put back",
    failure: {
      kind: "version-two-run-failed",
      failure: { kind: "run-failed", detail: "config unreadable" },
      unrestored: [
        { written: "file-created", path: SETTINGS, detail: "EBUSY" },
        { written: "directory-created", path: RECORDS_FOLDER, detail: "EACCES" },
        { written: "file-replaced", path: OLD_FILE, detail: "EPERM" },
      ],
    },
    outcome: {
      code: 1,
      text: `upgrade refused:\nversion 2's run failed (config unreadable). ${FAULT}\nThese files could not be put back; put them right by hand:\n  delete /repo/hone.config.json (EBUSY)\n  delete the empty folder /repo/hone-records (EACCES)\n  restore /repo/disciplines.eslint.mjs from version control (EPERM)\n`,
    },
  },
  {
    name: "the two runs differ",
    failure: { kind: "differences", differences: [{ section: "findings", onlyBefore: [], onlyAfter: ["CD-15#loops src/a.ts 3:1"] }], unrestored: [] },
    outcome: {
      code: 1,
      text: `upgrade refused:\nversion 2 does not report what version 1 reported:\n  findings:\n    only after: CD-15#loops src/a.ts 3:1\n${FAULT}\nNothing was changed.\n`,
    },
  },
  {
    name: "a version 1 file cannot be removed",
    failure: {
      kind: "removal-failed",
      failure: { kind: "unremovable", path: OLD_FILE, detail: "EBUSY", removed: { files: [], folders: [] } },
      written: [repoPathSchema.parse("hone.config.json"), repoPathSchema.parse("hone.eslint.mjs")],
      replaced: repoPathSchema.parse("eslint.config.mjs"),
      remaining: [OLD_FILE, OLD_SETTINGS],
    },
    outcome: {
      code: 3,
      text: "upgrade incomplete:\nversion 2 is in place (written: hone.config.json, hone.eslint.mjs; replaced: eslint.config.mjs), but /repo/disciplines.eslint.mjs could not be removed (EBUSY).\nDelete these version 1 files by hand, then commit:\n  /repo/disciplines.eslint.mjs\n  /repo/disciplines.json\n",
    },
  },
  {
    name: "a project clause has no version 2 check",
    failure: { kind: "plan-refused", refusal: { kind: "mapping-refused", refusals: [{ kind: "clause-without-check", clause: "acme/CD-1#thing" }] } },
    outcome: {
      code: 1,
      text: "upgrade refused:\nacme/CD-1#thing has no version 2 check to run it, and version 2 does not carry the clauses of a version 1 team rule set. Remove it from disciplines.json to upgrade without it, or stay on version 1.\nNothing was changed.\n",
    },
  },
];

describe("upgradeFailureOutcomeOf", () => {
  it.each(ROWS)("says what to do when $name", ({ failure, outcome }) => {
    expect(upgradeFailureOutcomeOf({ failure })).toEqual(outcome);
  });
});
