import { afterAll, assert, describe, expect, it } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import { createDefaultFileRemovalPort } from "../../../core/platform-ports/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../../../core/platform-ports/path-port.ts";
import { symptomCatalogueOf } from "../../../core/symptom-catalogue/symptom-catalogue-wire.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { FIRST_EDITION } from "../../../core/values/edition.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import SYMPTOMS from "../../../rules/typescript/symptoms.json" with { type: "json" };
import { ESLINT_LINES, type EslintLine, eslintPortOn, eslintRunnerOn, pieceModulesOn } from "../../../tests/eslint-toolchains.ts";
import { createDefaultScratchFilesPort } from "../../../scripts/install-proof-ports.ts";
import { scratchRepositoriesUnder } from "../../../tests/scratch-repositories.ts";
import ESLINT_CD_14_PIECE from "../CD-14/piece.json" with { type: "json" };
import { CHECKS_PROJECTION_PATH, checksProjectionText } from "./checks-projection.ts";
import type { ChecksRunRequest } from "./checks-run-types.ts";
import { createChecksRunner } from "./checks-runner.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../..`);

const CATALOGUE = symptomCatalogueOf({ document: SYMPTOMS });

assert(CATALOGUE.outcome === "ok");

const CLASS_SYNTAX = clauseAddressSchema.parse("CD-14#class-syntax");

const CLASS_CHECK = "authored-class-or-this#class-keyword";

const CLASS_RULE = "hone/authored-class-or-this/class-keyword";

const SOURCE_FILE = repoPathSchema.parse("kept.ts");

const BINDING_SETTINGS = ESLINT_CD_14_PIECE.clauses[0].settings;

const PIECE_ROOT = `${INSTALL_ROOT}/mechanisms/eslint/CD-14`;

const BINDINGS: ChecksRunRequest["bindings"] = [{ mechanism: "eslint", clause: { address: CLASS_SYNTAX, pieceRoot: PIECE_ROOT, settings: BINDING_SETTINGS } }];

const CLASS_PROJECTED = { symptom: "authored-class-or-this", check: "class-keyword", ruleId: CLASS_RULE, options: [] };

const PROJECTION_TEXT = checksProjectionText({ pluginImport: "../../api/eslint-plugin.ts", checks: [CLASS_PROJECTED], answered: [] });

const TEAM_CONFIG = `import hone from "./${CHECKS_PROJECTION_PATH}";\nexport default [...hone];\n`;

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText, scratch });

afterAll(() => {
  repositories.removeAll();
});

const NOTHING_ANSWERED: { readonly answered: ChecksRunRequest["answered"]; readonly declaredConfigRoots: readonly RepoPath[] } = { answered: [], declaredConfigRoots: [] };

const runnerOn = async (request: { readonly line: EslintLine }) =>
  createChecksRunner({
    fileText,
    fileRemoval: createDefaultFileRemovalPort({}),
    modules: pieceModulesOn({ line: request.line, base: createDefaultModuleLoaderPort({}) }),
    path: createDefaultPathPort({}),
    eslint: await eslintPortOn({ line: request.line }),
    moduleExtension: ".ts",
  });

const runOver = async (request: {
  readonly line: EslintLine;
  readonly files: Readonly<Record<string, string>>;
  readonly answered: ChecksRunRequest["answered"];
  readonly declaredConfigRoots: readonly RepoPath[];
}) => {
  const runner = await runnerOn(request);
  return runner.run({
    repoRoot: repositories.repositoryWith(request),
    installRoot: INSTALL_ROOT,
    files: [SOURCE_FILE],
    trackedPaths: [SOURCE_FILE],
    checks: CATALOGUE.value.checks,
    bindings: BINDINGS,
    answered: request.answered,
    declaredConfigRoots: request.declaredConfigRoots,
  });
};

const GOVERNING_WITHOUT_CHECKS = `export default [{ files: ["**/*.ts"], rules: {} }];
`;

const IGNORING_THE_SOURCE = `import hone from "./${CHECKS_PROJECTION_PATH}";
export default [{ ignores: ["kept.ts"] }, ...hone];
`;

const ADOPTED = { "eslint.config.mjs": TEAM_CONFIG, [CHECKS_PROJECTION_PATH]: PROJECTION_TEXT };

const CLASS_HIT = { clause: CLASS_SYNTAX, file: "kept.ts", anchor: { line: 1, column: 7 }, snippet: "export class Kept {}", check: CLASS_CHECK };

const CLASS_HIT_ON_LINE_2 = { ...CLASS_HIT, anchor: { line: 2, column: 7 } };

const MEASURED = [{ clause: CLASS_SYNTAX, file: "kept.ts" }];

const ONE_CLASS = "export class Kept {}\n";

const sourceDisabling = (request: { readonly ruleId: string }): string => `// eslint-disable-next-line ${request.ruleId}\n${ONE_CLASS}`;

const REPORT = { hits: [], nativeExceptions: [], measured: [], misnamedRuleIds: [], projection: "current" };

const V1_CLAUSE: RunnerClause = {
  address: CLASS_SYNTAX,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: PIECE_ROOT,
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: BINDING_SETTINGS,
};

const V1_CONFIG = `import projection from "./disciplines.eslint.mjs";\nexport default [...projection];\n`;

const V1_RUN = { installRoot: INSTALL_ROOT, files: [SOURCE_FILE], trackedPaths: [SOURCE_FILE], clauses: [V1_CLAUSE], declaredConfigRoots: [] };

describe.each(ESLINT_LINES)("the version 2 ESLint runner on %s, over a repository whose config spreads hone.eslint.mjs", (line) => {
  it("reports a class in its file, position and snippet, naming its check", async () => {
    expect(await runOver({ ...NOTHING_ANSWERED, line, files: { ...ADOPTED, "kept.ts": ONE_CLASS } })).toEqual({
      outcome: "ok",
      value: { ...REPORT, hits: [CLASS_HIT], measured: MEASURED },
    });
  });

  it("reports the same file, position and snippet as the version 1 runner does for the same source", async () => {
    const repoRoot = repositories.repositoryWith({ files: { "eslint.config.mjs": V1_CONFIG, "kept.ts": ONE_CLASS } });
    const runner = eslintRunnerOn({ line });
    await runner.project({ ...V1_RUN, repoRoot, records: [] });
    expect(await runner.run({ ...V1_RUN, repoRoot, records: [] })).toMatchObject({
      outcome: "ok",
      value: { hits: [{ clause: CLASS_SYNTAX, file: "kept.ts", anchor: CLASS_HIT.anchor, snippet: CLASS_HIT.snippet }] },
    });
  });

  it("reports no findings and a missing projection when hone.eslint.mjs is not written", async () => {
    expect(await runOver({ ...NOTHING_ANSWERED, line, files: { "eslint.config.mjs": TEAM_CONFIG, "kept.ts": ONE_CLASS } })).toEqual({ outcome: "ok", value: { ...REPORT, projection: "missing" } });
  });

  it("reports an out-of-date projection, and still the class, when hone.eslint.mjs differs from what project would write", async () => {
    expect(await runOver({ ...NOTHING_ANSWERED, line, files: { ...ADOPTED, [CHECKS_PROJECTION_PATH]: `${PROJECTION_TEXT}\n`, "kept.ts": ONE_CLASS } })).toEqual({
      outcome: "ok",
      value: { ...REPORT, hits: [CLASS_HIT], measured: MEASURED, projection: "out-of-date" },
    });
  });

  it("reports the projection not included when the team's config does not enable the checks", async () => {
    expect(await runOver({ ...NOTHING_ANSWERED, line, files: { "eslint.config.mjs": GOVERNING_WITHOUT_CHECKS, [CHECKS_PROJECTION_PATH]: PROJECTION_TEXT, "kept.ts": ONE_CLASS } })).toEqual({
      outcome: "ok",
      value: { ...REPORT, projection: "not-included" },
    });
  });

  it("reports an inline disable written with the check's id as a native exception on that check, beside the hit it does not remove", async () => {
    expect(await runOver({ ...NOTHING_ANSWERED, line, files: { ...ADOPTED, "kept.ts": sourceDisabling({ ruleId: CLASS_RULE }) } })).toEqual({
      outcome: "ok",
      value: {
        ...REPORT,
        hits: [CLASS_HIT_ON_LINE_2],
        nativeExceptions: [{ kind: "inline-disable", clause: CLASS_SYNTAX, file: "kept.ts", line: 1, text: `// eslint-disable-next-line ${CLASS_RULE}`, reach: "one-clause", check: CLASS_CHECK }],
        measured: MEASURED,
      },
    });
  });

  it("reports an inline disable written with a version 1 id as misnamed and suppresses nothing", async () => {
    expect(await runOver({ ...NOTHING_ANSWERED, line, files: { ...ADOPTED, "kept.ts": sourceDisabling({ ruleId: "hone/no-class-authoring" }) } })).toEqual({
      outcome: "ok",
      value: {
        ...REPORT,
        hits: [CLASS_HIT_ON_LINE_2],
        measured: MEASURED,
        misnamedRuleIds: [{ kind: "version-1-id", ruleId: "hone/no-class-authoring", file: "kept.ts", line: 1, text: "// eslint-disable-next-line hone/no-class-authoring" }],
      },
    });
  });

  it("reports an inline disable written with an id that names no check as misnamed and suppresses nothing", async () => {
    expect(await runOver({ ...NOTHING_ANSWERED, line, files: { ...ADOPTED, "kept.ts": sourceDisabling({ ruleId: "hone/authored-class-or-this/no-such-check" }) } })).toEqual({
      outcome: "ok",
      value: {
        ...REPORT,
        hits: [CLASS_HIT_ON_LINE_2],
        measured: MEASURED,
        misnamedRuleIds: [
          { kind: "names-no-check", ruleId: "hone/authored-class-or-this/no-such-check", file: "kept.ts", line: 1, text: "// eslint-disable-next-line hone/authored-class-or-this/no-such-check" },
        ],
      },
    });
  });

  it("reports a global ignore over the source as a native exception on the check", async () => {
    expect(await runOver({ ...NOTHING_ANSWERED, line, files: { "eslint.config.mjs": IGNORING_THE_SOURCE, [CHECKS_PROJECTION_PATH]: PROJECTION_TEXT, "kept.ts": ONE_CLASS } })).toEqual({
      outcome: "ok",
      value: {
        ...REPORT,
        hits: [CLASS_HIT],
        nativeExceptions: [{ kind: "ignore", clause: CLASS_SYNTAX, file: "kept.ts", check: CLASS_CHECK }],
        measured: MEASURED,
      },
    });
  });

  it("reports a config override of the check's rule after the projection as a native exception on that check", async () => {
    const config = `import hone from "./${CHECKS_PROJECTION_PATH}";\nexport default [...hone, { rules: { "${CLASS_RULE}": "off" } }];\n`;
    expect(await runOver({ ...NOTHING_ANSWERED, line, files: { "eslint.config.mjs": config, [CHECKS_PROJECTION_PATH]: PROJECTION_TEXT, "kept.ts": ONE_CLASS } })).toEqual({
      outcome: "ok",
      value: {
        ...REPORT,
        hits: [CLASS_HIT],
        nativeExceptions: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "kept.ts", check: CLASS_CHECK }],
        measured: MEASURED,
      },
    });
  });

  it("does not report the projection's own off block over an answered file as an override", async () => {
    const answered = [{ symptom: "authored-class-or-this", check: "class-keyword", file: SOURCE_FILE }];
    const projection = checksProjectionText({ pluginImport: "../../api/eslint-plugin.ts", checks: [CLASS_PROJECTED], answered });
    expect(await runOver({ ...NOTHING_ANSWERED, line, answered, files: { "eslint.config.mjs": TEAM_CONFIG, [CHECKS_PROJECTION_PATH]: projection, "kept.ts": ONE_CLASS } })).toEqual({
      outcome: "ok",
      value: { ...REPORT, hits: [CLASS_HIT], measured: MEASURED },
    });
  });

  it("is not ready for a repository that declares ESLint config roots", async () => {
    expect(await runOver({ ...NOTHING_ANSWERED, line, files: { ...ADOPTED, "kept.ts": ONE_CLASS }, declaredConfigRoots: [repoPathSchema.parse("packages/web")] })).toEqual({
      outcome: "failed",
      error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots" } },
    });
  });
});
