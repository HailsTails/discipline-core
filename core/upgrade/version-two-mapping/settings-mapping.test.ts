import { describe, expect, it } from "vitest";
import { LOOPS_CLAUSE, SETTINGS_CATALOGUE, TEST_BODY_CLAUSE } from "../../../tests/settings-catalogue.ts";
import type { ConsumerSelectionFile } from "../../consumer-selection/selection-file.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import type { SettingsFile } from "../../settings/settings-file.ts";
import type { Check, Engine } from "../../symptom-catalogue/symptom-catalogue.ts";
import { clauseAddressSchema } from "../../values/clause-address.ts";
import { mechanismIdSchema, ruleSetNameSchema } from "../../values/identifiers.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import { mappedSettings, type SettingsMappingRequest } from "./settings-mapping.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const LAYERING_CLAUSE = clauseAddressSchema.parse("CD-13#layering");

const LOOPS_CHECK = { ruleSet: "hone", check: "loop-keyword#loops" } as const;

const LOOP_KEYWORD_TEST_BODY = { ruleSet: "hone", check: "loop-keyword#test-body" } as const;

const REBINDING_TEST_BODY = { ruleSet: "hone", check: "rebinding#test-body" } as const;

const BASE_SELECTION: ConsumerSelectionFile = {
  version: 1,
  ruleSets: [],
  clauses: [],
  exclude: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "required",
  reportOutput: "full",
  assessment: { forfeiture: "this-run" },
  clauseSettings: [],
  checkEditions: "pinned",
};

const BASE_SETTINGS: SettingsFile = {
  exclude: [],
  ruleSets: [],
  checks: [],
  checkSettings: [],
  forfeiture: "this-run",
  reportOutput: "full",
  checkEditions: "pinned",
  eslintConfigLookup: { lookup: "detected" },
  eslintConfigRoots: [],
  conventions: { conventions: { generated: [], layers: [] }, declared: [] },
};

const BASE_REQUEST: SettingsMappingRequest = {
  selection: BASE_SELECTION,
  catalogues: [{ ruleSet: "hone", catalogue: SETTINGS_CATALOGUE }],
};

const WALKER: Engine = { name: "walker", mechanism: AUDIT };

const OTHER_WALKER: Engine = { name: "second-walker", mechanism: AUDIT };

const TWO_ENGINE_CHECK: Check = { ...SETTINGS_CATALOGUE.checks[0], engines: [WALKER, OTHER_WALKER] };

const TWO_ENGINE_CATALOGUES: readonly RuleSetCatalogue[] = [
  { ruleSet: "hone", catalogue: { ...SETTINGS_CATALOGUE, checks: [TWO_ENGINE_CHECK] } },
];

const okWith = (request: { readonly settings: Partial<SettingsFile> }) => ({
  outcome: "ok",
  value: { settings: { ...BASE_SETTINGS, ...request.settings }, drops: [] },
});

describe("mappedSettings carrying the settings that keep their name", () => {
  it("keeps a declared rule set and its location", () => {
    const team = ruleSetNameSchema.parse("team");
    const location = { location: "folder", path: repoPathSchema.parse("team-rules") } as const;
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, ruleSets: [[team, location]] } })).toEqual(
      okWith({ settings: { ruleSets: [{ name: team, location }] } }),
    );
  });

  it("keeps the excluded paths", () => {
    const vendor = repoPathSchema.parse("vendor");
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, exclude: [vendor] } })).toEqual(
      okWith({ settings: { exclude: [vendor] } }),
    );
  });

  it("keeps a declared ESLint config lookup", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, eslintConfigLookup: "repository-root" } })).toEqual(
      okWith({ settings: { eslintConfigLookup: { lookup: "declared", value: "repository-root" } } }),
    );
  });

  it("detects the ESLint config when version 1 declared no lookup", () => {
    expect(mappedSettings(BASE_REQUEST)).toEqual(okWith({ settings: { eslintConfigLookup: { lookup: "detected" } } }));
  });

  it("keeps the report output", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, reportOutput: "counts" } })).toEqual(
      okWith({ settings: { reportOutput: "counts" } }),
    );
  });

  it("moves the assessment's forfeiture to the top level, the adopter's own value", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, assessment: { forfeiture: "elsewhere" } } })).toEqual(
      okWith({ settings: { forfeiture: "elsewhere" } }),
    );
  });

  it("keeps the check editions rule", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, checkEditions: "latest" } })).toEqual(
      okWith({ settings: { checkEditions: "latest" } }),
    );
  });

  it("writes no ESLint projection setting, since version 1 has none", () => {
    expect(mappedSettings(BASE_REQUEST)).toEqual(okWith({ settings: {} }));
  });
});

describe("mappedSettings turning clauses into checks", () => {
  it("lists a clause run on a mechanism as its check, run by that check's engine on the mechanism", () => {
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, { state: "run", mechanism: AUDIT }]] } }),
    ).toEqual(okWith({ settings: { checks: [{ address: LOOPS_CHECK, state: { state: "run", engine: "walker" } }] } }));
  });

  it("lists one entry for each check of a clause that has two", () => {
    expect(
      mappedSettings({
        ...BASE_REQUEST,
        selection: { ...BASE_SELECTION, clauses: [[TEST_BODY_CLAUSE, { state: "run", mechanism: AUDIT }]] },
      }),
    ).toEqual(
      okWith({
        settings: {
          checks: [
            { address: LOOP_KEYWORD_TEST_BODY, state: { state: "run", engine: "walker" } },
            { address: REBINDING_TEST_BODY, state: { state: "run", engine: "walker" } },
          ],
        },
      }),
    );
  });

  it("copies not-run to every check of the clause", () => {
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, clauses: [[TEST_BODY_CLAUSE, { state: "not-run" }]] } }),
    ).toEqual(
      okWith({
        settings: {
          checks: [
            { address: LOOP_KEYWORD_TEST_BODY, state: { state: "not-run" } },
            { address: REBINDING_TEST_BODY, state: { state: "not-run" } },
          ],
        },
      }),
    );
  });

  it("copies not-adopted to the check of the clause", () => {
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, { state: "not-adopted" }]] } }),
    ).toEqual(okWith({ settings: { checks: [{ address: LOOPS_CHECK, state: { state: "not-adopted" } }] } }));
  });

  it("refuses a clause with no check", () => {
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, clauses: [[LAYERING_CLAUSE, { state: "not-run" }]] } }),
    ).toEqual({ outcome: "failed", error: [{ kind: "clause-without-check", clause: "CD-13#layering" }] });
  });

  it("refuses a check with no engine on the mechanism the clause was run on", () => {
    const oxlint = mechanismIdSchema.parse("oxlint");
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, { state: "run", mechanism: oxlint }]] } }),
    ).toEqual({ outcome: "failed", error: [{ kind: "no-engine-on-mechanism", check: "loop-keyword#loops", mechanism: oxlint }] });
  });

  it("refuses a check with two engines on the mechanism, naming both", () => {
    expect(
      mappedSettings({
        ...BASE_REQUEST,
        catalogues: TWO_ENGINE_CATALOGUES,
        selection: { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, { state: "run", mechanism: AUDIT }]] },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "two-engines-on-mechanism", check: "loop-keyword#loops", mechanism: AUDIT, engines: ["walker", "second-walker"] }],
    });
  });
});

describe("mappedSettings carrying ESLint config roots", () => {
  it("carries a non-empty list over as it is", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, eslintConfigRoots: [repoPathSchema.parse("packages/a")] } })).toEqual(
      okWith({ settings: { eslintConfigRoots: [repoPathSchema.parse("packages/a")] } }),
    );
  });

  it("writes an empty list when version 1 listed none", () => {
    expect(mappedSettings(BASE_REQUEST)).toEqual(okWith({ settings: { eslintConfigRoots: [] } }));
  });
});

describe("mappedSettings turning clauseSettings into checkSettings", () => {
  const LOOPS_RUN = { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, { state: "run", mechanism: AUDIT }]] } satisfies ConsumerSelectionFile;

  it("gives a setting to the check of the clause under the version 2 name", () => {
    expect(
      mappedSettings({
        ...BASE_REQUEST,
        selection: { ...LOOPS_RUN, clauseSettings: [[LOOPS_CLAUSE, { confinedPackages: ["eslint"], limit: 5 }]] },
      }),
    ).toEqual(
      okWith({
        settings: {
          checks: [{ address: LOOPS_CHECK, state: { state: "run", engine: "walker" } }],
          checkSettings: [{ address: LOOPS_CHECK, values: { confinedOutsideDependencies: ["eslint"], limit: 5 } }],
        },
      }),
    );
  });

  it("gives the settings of a clause to every one of its checks", () => {
    expect(
      mappedSettings({
        ...BASE_REQUEST,
        selection: {
          ...BASE_SELECTION,
          clauses: [[TEST_BODY_CLAUSE, { state: "run", mechanism: AUDIT }]],
          clauseSettings: [[TEST_BODY_CLAUSE, { limit: 4 }]],
        },
      }),
    ).toEqual(
      okWith({
        settings: {
          checks: [
            { address: LOOP_KEYWORD_TEST_BODY, state: { state: "run", engine: "walker" } },
            { address: REBINDING_TEST_BODY, state: { state: "run", engine: "walker" } },
          ],
          checkSettings: [
            { address: LOOP_KEYWORD_TEST_BODY, values: { limit: 4 } },
            { address: REBINDING_TEST_BODY, values: { limit: 4 } },
          ],
        },
      }),
    );
  });

  it("copies the edition to the check's settings", () => {
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...LOOPS_RUN, clauseSettings: [[LOOPS_CLAUSE, { edition: "2" }]] } }),
    ).toEqual(
      okWith({
        settings: {
          checks: [{ address: LOOPS_CHECK, state: { state: "run", engine: "walker" } }],
          checkSettings: [{ address: LOOPS_CHECK, values: { edition: "2" } }],
        },
      }),
    );
  });

  it("gives a setting the check may not declare as it is, leaving version 2's reader to refuse it", () => {
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...LOOPS_RUN, clauseSettings: [[LOOPS_CLAUSE, { colour: "red" }]] } }),
    ).toEqual(
      okWith({
        settings: {
          checks: [{ address: LOOPS_CHECK, state: { state: "run", engine: "walker" } }],
          checkSettings: [{ address: LOOPS_CHECK, values: { colour: "red" } }],
        },
      }),
    );
  });
});

describe("mappedSettings dropping what version 2 has no setting for", () => {
  it("names the optional file exception why-chains as dropped", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, fileExceptionWhyChains: "optional" } })).toEqual({
      outcome: "ok",
      value: { settings: BASE_SETTINGS, drops: [{ kind: "file-exception-why-chains", value: "optional" }] },
    });
  });

  it("drops nothing for the required why-chains, which lose nothing", () => {
    expect(mappedSettings(BASE_REQUEST)).toEqual(okWith({ settings: {} }));
  });
});
