import { describe, expect, it, vi } from "vitest";
import { LOOP_KEYWORD_LOOPS, LOOPS_CLAUSE, SETTINGS_CATALOGUE } from "../../../tests/settings-catalogue.ts";
import type { ConsumerSelectionFile } from "../../consumer-selection/selection-file.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import { TOOL_RULE_SET } from "../../values/clause-address.ts";
import { mechanismIdSchema } from "../../values/identifiers.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import type { HeadRecord } from "../version-one-head/head-records.ts";
import type { FileCarveOutRecord } from "../carve-out-oracle/carve-out-oracle.ts";
import type { RecordInput } from "../version-two-mapping/records-mapping.ts";
import { type ProjectionFilesOf, type UpgradePlanRequest, upgradePlanOf, type VersionOneReading } from "./upgrade-plan.ts";

const CATALOGUES: readonly RuleSetCatalogue[] = [{ ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE }];

const AUDIT = mechanismIdSchema.parse("audit");

const SRC_A = repoPathSchema.parse("src/a.ts");

const SELECTION: ConsumerSelectionFile = {
  version: 1,
  ruleSets: [],
  clauses: [[LOOPS_CLAUSE, { state: "run", mechanism: AUDIT }]],
  exclude: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "required",
  reportOutput: "full",
  assessment: { forfeiture: "this-run" },
  clauseSettings: [],
  checkEditions: "pinned",
};

const CARVE_OUT: FileCarveOutRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" };

const CARVE_OUT_HEAD: HeadRecord = {
  kind: "file-carve-out",
  record: CARVE_OUT,
  entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" },
};

const TEAM_CONFIG = { file: repoPathSchema.parse("eslint.config.mjs"), text: 'import disciplines from "./disciplines.eslint.mjs";\nexport default [...disciplines];\n' };

const READING: VersionOneReading = {
  selection: SELECTION,
  heads: [CARVE_OUT_HEAD],
  teamConfig: TEAM_CONFIG,
  versionOneProjection: repoPathSchema.parse("disciplines.eslint.mjs"),
};

const FINDINGS_ON_LOOPS = { record: CARVE_OUT, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } } as const;

const CARVE_OUT_INPUT: RecordInput = { ...CARVE_OUT_HEAD, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } };

const PLANNED_SETTINGS = {
  file: "hone.config.json",
  text: '{\n  "version": 2,\n  "ruleSets": {},\n  "checks": {\n    "loop-keyword#loops": "walker"\n  }\n}\n',
};

const PLANNED_DEBT = {
  file: "hone-records/debt/loop-keyword.json",
  text: '{\n  "version": 2,\n  "records": [\n    {\n      "symptom": "loop-keyword#loops",\n      "file": "src/a.ts",\n      "note": "legacy loop"\n    }\n  ]\n}\n',
};

const PLANNED_PROJECTION = { file: repoPathSchema.parse("hone.eslint.mjs"), text: "projection text" };

const projecting = (request: { readonly files: readonly (typeof PLANNED_PROJECTION)[] }) =>
  vi.fn<ProjectionFilesOf>().mockResolvedValue({ outcome: "ok", value: request.files });

const REWRITTEN_CONFIG = { file: "eslint.config.mjs", text: 'import disciplines from "./hone.eslint.mjs";\nexport default [...disciplines];\n' };

const requestOver =(overrides: Partial<UpgradePlanRequest>): UpgradePlanRequest => ({
  reading: READING,
  answered: [FINDINGS_ON_LOOPS],
  catalogues: CATALOGUES,
  projectionFilesOf: projecting({ files: [PLANNED_PROJECTION] }),
  ...overrides,
});

describe("upgradePlanOf", () => {
  it("plans the settings, the debt records, the projection and the rewritten team config for a repository that carries over", async () => {
    await expect(upgradePlanOf(requestOver({}))).resolves.toEqual({
      outcome: "ok",
      value: { inputs: [CARVE_OUT_INPUT], files: [PLANNED_SETTINGS, PLANNED_DEBT, PLANNED_PROJECTION], replacement: REWRITTEN_CONFIG },
    });
  });

  it("asks for the projection files over the settings and the record documents it planned", async () => {
    const projectionFilesOf = projecting({ files: [PLANNED_PROJECTION] });
    await upgradePlanOf(requestOver({ projectionFilesOf }));
    expect(projectionFilesOf).toHaveBeenCalledExactlyOnceWith({
      settings: {
        exclude: [],
        ruleSets: [],
        checks: [{ address: { ruleSet: "hone", check: "loop-keyword#loops" }, state: { state: "run", engine: "walker" } }],
        checkSettings: [],
        forfeiture: "this-run",
        reportOutput: "full",
        checkEditions: "pinned",
        eslintConfigLookup: { lookup: "detected" },
        eslintConfigRoots: [],
        conventions: { conventions: { generated: [], layers: [] }, declared: [] },
      },
      documents: [{ file: "hone-records/debt/loop-keyword.json", version: 2, records: [{ symptom: "loop-keyword#loops", file: "src/a.ts", note: "legacy loop" }] }],
    });
  });

  it("plans no projection file when the engines project none and there is no team config to point at one", async () => {
    await expect(upgradePlanOf(requestOver({ projectionFilesOf: projecting({ files: [] }), reading: { ...READING, teamConfig: undefined } }))).resolves.toEqual({
      outcome: "ok",
      value: { inputs: [CARVE_OUT_INPUT], files: [PLANNED_SETTINGS, PLANNED_DEBT], replacement: undefined },
    });
  });

  it("refuses when the projection could not be made", async () => {
    const failed = vi.fn<ProjectionFilesOf>().mockResolvedValue({ outcome: "failed", error: { kind: "projection-failed", detail: "eslint missing" } });
    await expect(upgradePlanOf(requestOver({ projectionFilesOf: failed }))).resolves.toEqual({ outcome: "failed", error: { kind: "projection-failed", detail: "eslint missing" } });
  });

  it("refuses when the team config would have to import other than exactly one projected file", async () => {
    await expect(upgradePlanOf(requestOver({ projectionFilesOf: projecting({ files: [] }) }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-single", files: [] },
    });
  });

  it("refuses a file carve-out the oracle gave no answer for", async () => {
    await expect(upgradePlanOf(requestOver({ answered: [] }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "carve-out-unanswered", clause: "CD-15#loops", file: "src/a.ts" },
    });
  });

  it("refuses with the mapping's own refusals when a carve-out answered nothing", async () => {
    await expect(upgradePlanOf(requestOver({ answered: [{ record: CARVE_OUT, answer: { credit: "nothing" } }] }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "mapping-refused", refusals: [{ kind: "record-answers-nothing", clause: "CD-15#loops", file: "src/a.ts", credited: "nothing" }] },
    });
  });

  it("refuses naming the team config when it holds no import of the version 1 projection", async () => {
    await expect(upgradePlanOf(requestOver({ reading: { ...READING, teamConfig: { ...TEAM_CONFIG, text: "export default [];\n" } } }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "config-import-refused", refusal: { kind: "no-projection-import", file: "eslint.config.mjs" } },
    });
  });

  it("plans no replacement when version 1 had no projection to import", async () => {
    await expect(upgradePlanOf(requestOver({ reading: { ...READING, versionOneProjection: undefined } }))).resolves.toEqual({
      outcome: "ok",
      value: { inputs: [CARVE_OUT_INPUT], files: [PLANNED_SETTINGS, PLANNED_DEBT, PLANNED_PROJECTION], replacement: undefined },
    });
  });

  it("plans no replacement when the repository has no team config", async () => {
    await expect(upgradePlanOf(requestOver({ reading: { ...READING, teamConfig: undefined } }))).resolves.toEqual({
      outcome: "ok",
      value: { inputs: [CARVE_OUT_INPUT], files: [PLANNED_SETTINGS, PLANNED_DEBT, PLANNED_PROJECTION], replacement: undefined },
    });
  });
});
