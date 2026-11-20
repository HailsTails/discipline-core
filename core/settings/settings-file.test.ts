import { describe, expect, it } from "vitest";
import { ruleSetNameSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { DEFAULT_CONVENTIONS } from "./conventions.ts";
import { type SettingsFile, type SettingsFileFault, settingsFileOf } from "./settings-file.ts";

const SMALLEST_DOCUMENT = { version: 2, ruleSets: {}, checks: {} };

const SMALLEST_FILE: SettingsFile = {
  exclude: [],
  ruleSets: [],
  checks: [],
  checkSettings: [],
  forfeiture: "this-run",
  reportOutput: "full",
  checkEditions: "pinned",
  eslintConfigLookup: { lookup: "detected" },
  eslintConfigRoots: [],
  conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
};

describe("settingsFileOf", () => {
  it("reads the smallest file with every default today's version 1 file gives", () => {
    expect(settingsFileOf({ document: SMALLEST_DOCUMENT })).toEqual({ outcome: "ok", value: SMALLEST_FILE });
  });

  it("reads every key of the plan's version 2 file, field by field", () => {
    expect(
      settingsFileOf({
        document: {
          version: 2,
          exclude: ["vendor"],
          ruleSets: { team: "tools/hone-rules", local: "." },
          checks: {
            "date-used-directly#clock-sources": "walker",
            "claimed-type#non-null-assertions": "eslint",
            "team/no-tmp-file#tmp-paths": "not-run",
            "loop-keyword#loops": "not-adopted",
          },
          checkSettings: {
            "outside-import-past-a-boundary#import-boundaries": { confinedOutsideDependencies: ["uuid"] },
            "branch-in-a-test#test-body": { edition: "2" },
          },
          forfeiture: "elsewhere",
          reportOutput: "counts",
          checkEditions: "latest",
          eslintConfigLookup: "nearest-to-file",
          eslintConfigRoots: ["web"],
          conventions: {},
          layers: {},
        },
      }),
    ).toEqual<{ readonly outcome: "ok"; readonly value: SettingsFile }>({
      outcome: "ok",
      value: {
        exclude: [repoPathSchema.parse("vendor")],
        ruleSets: [
          { name: ruleSetNameSchema.parse("team"), location: { location: "folder", path: repoPathSchema.parse("tools/hone-rules") } },
          { name: ruleSetNameSchema.parse("local"), location: { location: "repo-root" } },
        ],
        checks: [
          { address: { ruleSet: "hone", check: "date-used-directly#clock-sources" }, state: { state: "run", engine: "walker" } },
          { address: { ruleSet: "hone", check: "claimed-type#non-null-assertions" }, state: { state: "run", engine: "eslint" } },
          { address: { ruleSet: { name: ruleSetNameSchema.parse("team") }, check: "no-tmp-file#tmp-paths" }, state: { state: "not-run" } },
          { address: { ruleSet: "hone", check: "loop-keyword#loops" }, state: { state: "not-adopted" } },
        ],
        checkSettings: [
          { address: { ruleSet: "hone", check: "outside-import-past-a-boundary#import-boundaries" }, values: { confinedOutsideDependencies: ["uuid"] } },
          { address: { ruleSet: "hone", check: "branch-in-a-test#test-body" }, values: { edition: "2" } },
        ],
        forfeiture: "elsewhere",
        reportOutput: "counts",
        checkEditions: "latest",
        eslintConfigLookup: { lookup: "declared", value: "nearest-to-file" },
        eslintConfigRoots: [repoPathSchema.parse("web")],
        conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
      },
    });
  });

  it("hands the conventions and layers it declares to their own reading", () => {
    expect(settingsFileOf({ document: { ...SMALLEST_DOCUMENT, layers: { domain: ["src/domain"] } } })).toMatchObject({
      outcome: "ok",
      value: { conventions: { conventions: { layers: [{ layer: "domain", folders: ["src/domain"] }] }, declared: ["layers"] } },
    });
  });

  type RefusalRow = { readonly name: string; readonly document: unknown; readonly fault: SettingsFileFault };

  it.each<RefusalRow>([
    {
      name: "the reason-only option, which version 2 does not have",
      document: { ...SMALLEST_DOCUMENT, fileExceptionWhyChains: "optional" },
      fault: { kind: "malformed", detail: "✖ removed: \"fileExceptionWhyChains\"; every record shows its why-chain in version 2\n  → at fileExceptionWhyChains" },
    },
    {
      name: "version 1's clauses, which version 2 calls checks",
      document: { ...SMALLEST_DOCUMENT, clauses: {} },
      fault: { kind: "malformed", detail: "✖ renamed: \"clauses\" is \"checks\" in version 2, addressed <symptom>#<check>\n  → at clauses" },
    },
    {
      name: "version 1's clauseSettings, which version 2 calls checkSettings",
      document: { ...SMALLEST_DOCUMENT, clauseSettings: {} },
      fault: { kind: "malformed", detail: "✖ renamed: \"clauseSettings\" is \"checkSettings\" in version 2, addressed <symptom>#<check>\n  → at clauseSettings" },
    },
    {
      name: "version 1's assessment, whose forfeiture is a top-level key in version 2",
      document: { ...SMALLEST_DOCUMENT, assessment: { forfeiture: "elsewhere" } },
      fault: { kind: "malformed", detail: "✖ renamed: \"assessment\" is \"forfeiture\" in version 2, at the top level\n  → at assessment" },
    },
    {
      name: "version 1's setting name for confined outside dependencies",
      document: { ...SMALLEST_DOCUMENT, checkSettings: { "outside-import-past-a-boundary#import-boundaries": { confinedPackages: ["uuid"] } } },
      fault: {
        kind: "malformed",
        detail: "✖ renamed: \"confinedPackages\" is \"confinedOutsideDependencies\" in version 2\n  → at checkSettings[\"outside-import-past-a-boundary#import-boundaries\"].confinedPackages",
      },
    },
    {
      name: "tracker patterns, which version 2 gives as a closed list of pointer forms",
      document: { ...SMALLEST_DOCUMENT, checkSettings: { "untracked-pointer#todo-pointers": { trackerPatterns: ["^\\(\\S+\\)$"] } } },
      fault: {
        kind: "malformed",
        detail:
          "✖ removed: \"trackerPatterns\"; version 2 names tracked pointer forms in conventions.trackedPointers\n  → at checkSettings[\"untracked-pointer#todo-pointers\"].trackerPatterns",
      },
    },
    {
      name: "a key the file does not define",
      document: { ...SMALLEST_DOCUMENT, numbers: [] },
      fault: { kind: "malformed", detail: "✖ Unrecognized key: \"numbers\"" },
    },
    {
      name: "a version other than 2",
      document: { ...SMALLEST_DOCUMENT, version: 1 },
      fault: { kind: "malformed", detail: "✖ Invalid input: expected 2\n  → at version" },
    },
    {
      name: "a check address that is not <symptom>#<check>",
      document: { ...SMALLEST_DOCUMENT, checks: { "CD-15": "walker" } },
      fault: { kind: "malformed", detail: "✖ is not a check address of the form [<ruleSet>/]<symptom>#<check>\n  → at checks[0][0]" },
    },
    {
      name: "a check state that is no engine's name",
      document: { ...SMALLEST_DOCUMENT, checks: { "loop-keyword#loops": "Walker" } },
      fault: { kind: "malformed", detail: "✖ a check takes an engine, \"not-run\" or \"not-adopted\"\n  → at checks[0][1]" },
    },
    {
      name: "an exclude entry that is a glob",
      document: { ...SMALLEST_DOCUMENT, exclude: ["vendor/**"] },
      fault: { kind: "malformed", detail: "✖ an exclude entry is a repository path, not a glob\n  → at exclude[0]" },
    },
    {
      name: "a forfeiture outside its two choices",
      document: { ...SMALLEST_DOCUMENT, forfeiture: "never" },
      fault: { kind: "malformed", detail: "✖ Invalid option: expected one of \"this-run\"|\"elsewhere\"\n  → at forfeiture" },
    },
    {
      name: "a casing entry that sets no casing, through the conventions reading",
      document: { ...SMALLEST_DOCUMENT, conventions: { casing: [{ files: ["**"] }] } },
      fault: {
        kind: "malformed",
        detail: "✖ a casing entry sets at least one of fileNames, variables, constants, functions, parameters, types, enumMembers, classMembers, objectProperties, typeProperties\n  → at conventions.casing[0]",
      },
    },
    {
      name: "a rule set named as Hone's own",
      document: { ...SMALLEST_DOCUMENT, ruleSets: { "hone-team": "tools/team" } },
      fault: { kind: "reserved-rule-set-name", name: "hone-team" },
    },
    {
      name: "a rule set whose name another extends",
      document: { ...SMALLEST_DOCUMENT, ruleSets: { team: "tools/team", "team-web": "tools/web" } },
      fault: { kind: "rule-set-name-collision", name: "team", other: "team-web" },
    },
  ])("refuses $name", ({ document, fault }) => {
    expect(settingsFileOf({ document })).toEqual({ outcome: "failed", error: fault });
  });
});
