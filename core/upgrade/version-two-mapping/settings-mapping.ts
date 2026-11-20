import type { ClauseSettingValues } from "../../mechanism-port/runner-module-types.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import { DEFAULT_CONVENTIONS } from "../../settings/conventions.ts";
import type { ListedAddress } from "../../settings/listed-address.ts";
import {
  type CheckState,
  eslintConfigLookupOf,
  type GivenCheckSettings,
  type ListedCheck,
  RENAMED_SETTINGS,
  type SettingsFile,
} from "../../settings/settings-file.ts";
import { checkAddressOf } from "../../symptom-catalogue/check-address.ts";
import type { Check } from "../../symptom-catalogue/symptom-catalogue.ts";
import { type ClauseAddress, clauseAddressText, sameClauseAddress } from "../../values/clause-address.ts";
import type { Result } from "../../values/result.ts";
import type { ClauseChoice, ConsumerSelectionFile } from "../../consumer-selection/selection-file.ts";
import { checksOfClause } from "./clause-checks.ts";
import type { UpgradeDrop, UpgradeRefusal } from "./upgrade-refusal.ts";

export type SettingsMappingRequest = {
  readonly selection: ConsumerSelectionFile;
  readonly catalogues: readonly RuleSetCatalogue[];
};

export type MappedSettings = { readonly settings: SettingsFile; readonly drops: readonly UpgradeDrop[] };

type ClauseListing = {
  readonly clause: ClauseAddress;
  readonly listed: readonly ListedCheck[];
  readonly refusals: readonly UpgradeRefusal[];
};

const stateOf = (request: { readonly check: Check; readonly choice: ClauseChoice }): Result<CheckState, UpgradeRefusal> => {
  const { choice, check } = request;
  if (choice.state !== "run") {
    return { outcome: "ok", value: { state: choice.state } };
  }
  const engines = check.engines.filter((engine) => engine.mechanism === choice.mechanism);
  const [engine, ...others] = engines;
  if (engine === undefined) {
    return { outcome: "failed", error: { kind: "no-engine-on-mechanism", check: checkAddressOf({ check }), mechanism: choice.mechanism } };
  }
  return others.length === 0
    ? { outcome: "ok", value: { state: "run", engine: engine.name } }
    : {
        outcome: "failed",
        error: {
          kind: "two-engines-on-mechanism",
          check: checkAddressOf({ check }),
          mechanism: choice.mechanism,
          engines: engines.map(({ name }) => name),
        },
      };
};

const listedAddressOf = (request: { readonly clause: ClauseAddress; readonly check: Check }): ListedAddress => ({
  ruleSet: request.clause.ruleSet,
  check: checkAddressOf({ check: request.check }),
});

const listingOf = (request: {
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly clause: ClauseAddress;
  readonly choice: ClauseChoice;
}): ClauseListing => {
  const checks = checksOfClause(request);
  if (checks.length === 0) {
    return { clause: request.clause, listed: [], refusals: [{ kind: "clause-without-check", clause: clauseAddressText({ address: request.clause }) }] };
  }
  const states = checks.map((check) => ({ check, state: stateOf({ check, choice: request.choice }) }));
  return {
    clause: request.clause,
    listed: states.flatMap(({ check, state }) =>
      state.outcome === "ok" ? [{ address: listedAddressOf({ clause: request.clause, check }), state: state.value }] : [],
    ),
    refusals: states.flatMap(({ state }) => (state.outcome === "failed" ? [state.error] : [])),
  };
};

const versionTwoNameOf = (request: { readonly setting: string }): string =>
  RENAMED_SETTINGS.find(({ pieceName }) => pieceName === request.setting)?.name ?? request.setting;

const renamedValuesOf = (request: { readonly values: ClauseSettingValues }): ClauseSettingValues =>
  Object.fromEntries(Object.entries(request.values).map(([setting, given]) => [versionTwoNameOf({ setting }), given]));

const givenSettingsOf = (request: {
  readonly selection: ConsumerSelectionFile;
  readonly listings: readonly ClauseListing[];
}): readonly GivenCheckSettings[] =>
  request.selection.clauseSettings.flatMap(([clause, values]) =>
    (request.listings.find((listing) => sameClauseAddress({ left: listing.clause, right: clause }) === "same")?.listed ?? []).map(
      ({ address }) => ({ address, values: renamedValuesOf({ values }) }),
    ),
  );

const rootsRefusalsOf = (request: { readonly selection: ConsumerSelectionFile }): readonly UpgradeRefusal[] =>
  request.selection.eslintConfigRoots.length === 0 ? [] : [{ kind: "eslint-config-roots", roots: request.selection.eslintConfigRoots }];

const whyChainDropsOf = (request: { readonly selection: ConsumerSelectionFile }): readonly UpgradeDrop[] =>
  request.selection.fileExceptionWhyChains === "optional" ? [{ kind: "file-exception-why-chains", value: "optional" }] : [];

export const mappedSettings = (request: SettingsMappingRequest): Result<MappedSettings, readonly UpgradeRefusal[]> => {
  const { selection } = request;
  const listings = selection.clauses.map(([clause, choice]) => listingOf({ catalogues: request.catalogues, clause, choice }));
  const refusals = [...rootsRefusalsOf({ selection }), ...listings.flatMap((listing) => listing.refusals)];
  if (refusals.length > 0) {
    return { outcome: "failed", error: refusals };
  }
  return {
    outcome: "ok",
    value: {
      settings: {
        exclude: selection.exclude,
        ruleSets: selection.ruleSets.map(([name, location]) => ({ name, location })),
        checks: listings.flatMap((listing) => listing.listed),
        checkSettings: givenSettingsOf({ selection, listings }),
        forfeiture: selection.assessment.forfeiture,
        reportOutput: selection.reportOutput,
        checkEditions: selection.checkEditions,
        eslintConfigLookup: eslintConfigLookupOf({ declared: selection.eslintConfigLookup }),
        eslintConfigRoots: [],
        conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
      },
      drops: whyChainDropsOf({ selection }),
    },
  };
};
