import type { ClauseBinding } from "../core/settings/selection.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import { checksOf } from "../core/symptom-catalogue/check-address.ts";
import type { SymptomCatalogue } from "../core/symptom-catalogue/symptom-catalogue.ts";
import { checkRuleIdOf, runsOnEslint } from "../mechanisms/eslint/runner/check-rule-id.ts";
import { type EslintPieceSettings, eslintPieceSettingsSchema, ruleOptionsOf } from "../mechanisms/eslint/runner/eslint-piece-settings-schema.ts";
import type { ProjectedPiece } from "../mechanisms/eslint/runner/projection-text.ts";

export type SpecifierOf = (request: { readonly modulePath: string }) => string;

type SettledBinding = { readonly binding: ClauseBinding; readonly settings: EslintPieceSettings };

const ESLINT_MECHANISM = "eslint";

const settledBindingsOf = (request: { readonly bindings: readonly ClauseBinding[] }): readonly SettledBinding[] =>
  request.bindings
    .filter((binding) => binding.mechanism === ESLINT_MECHANISM)
    .flatMap((binding) => {
      const settings = eslintPieceSettingsSchema.safeParse(binding.clause.settings);
      return settings.success ? [{ binding, settings: settings.data }] : [];
    });

const versionOneRuleIdOf = (request: { readonly settings: EslintPieceSettings }): string => `${request.settings.pluginNamespace}/${request.settings.rule}`;

export const versionOnePiecesOf = (request: {
  readonly bindings: readonly ClauseBinding[];
  readonly path: PathPort;
  readonly specifierOf: SpecifierOf;
}): readonly ProjectedPiece[] => {
  const settledBindings = settledBindingsOf(request);
  return settledBindings
    .filter((settled, index) => settledBindings.findIndex((other) => other.settings.pluginNamespace === settled.settings.pluginNamespace) === index)
    .map((leader) => ({
      pluginNamespace: leader.settings.pluginNamespace,
      pluginImport: request.specifierOf({ modulePath: request.path.join({ segments: [leader.binding.clause.pieceRoot, leader.settings.pluginModule] }) }),
      clauses: settledBindings
        .filter((settled) => settled.settings.pluginNamespace === leader.settings.pluginNamespace)
        .map((settled) => ({
          address: settled.binding.clause.address,
          ruleId: versionOneRuleIdOf({ settings: settled.settings }),
          options: ruleOptionsOf({ settings: settled.settings }),
        })),
    }));
};

const checkRuleIdsOfBinding = (request: { readonly catalogue: Pick<SymptomCatalogue, "checks">; readonly settled: SettledBinding }): readonly string[] =>
  checksOf({ catalogue: request.catalogue, clause: request.settled.binding.clause.address })
    .filter((check) => runsOnEslint({ check }) === "eslint")
    .map((check) => checkRuleIdOf({ check }));

export const inCheckRuleIds = <Entry>(request: {
  readonly catalogue: Pick<SymptomCatalogue, "checks">;
  readonly bindings: readonly ClauseBinding[];
  readonly rules: Readonly<Record<string, Entry>>;
}): Readonly<Record<string, Entry>> => {
  const renames = new Map(
    settledBindingsOf(request).flatMap((settled) =>
      checkRuleIdsOfBinding({ catalogue: request.catalogue, settled }).map((ruleId): readonly [string, string] => [versionOneRuleIdOf(settled), ruleId]),
    ),
  );
  return Object.fromEntries(Object.entries(request.rules).map(([ruleId, entry]) => [renames.get(ruleId) ?? ruleId, entry]));
};
