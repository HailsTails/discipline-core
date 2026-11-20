import { z } from "zod";
import type { PieceFailure } from "../../../core/mechanism-port/piece-failure-types.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import { type ClauseAddress, sameClauseAddress } from "../../../core/values/clause-address.ts";
import { gatheredOutcomes } from "../../../core/values/gathered-outcomes.ts";
import type { Result } from "../../../core/values/result.ts";
import type { CoreInstall } from "./core-install.ts";
import { eslintPieceSettingsSchema, ruleOptionsOf } from "./eslint-piece-settings-schema.ts";
import { type PluginImport, pluginImportOf } from "./projection.ts";
import { checkRuleIdOf, type RuledCheck, runsOnEslint } from "./check-rule-id.ts";
import type { ProjectedCheck } from "./checks-projection.ts";

type PieceInvalid = Extract<PieceFailure, { readonly kind: "piece-invalid" }>;

export type ProjectedBinding = { readonly mechanism: string; readonly clause: { readonly address: ClauseAddress; readonly pieceRoot: string; readonly settings: unknown } };

const ESLINT_MECHANISM = "eslint";

const PLUGIN_EXPORT = "eslint-plugin";

const PLUGIN_SOURCE = "api/eslint-plugin.ts";

const projectedChecksOfBinding = (request: {
  readonly checks: readonly RuledCheck[];
  readonly binding: ProjectedBinding;
}): Result<readonly ProjectedCheck[], PieceInvalid> => {
  const settings = eslintPieceSettingsSchema.safeParse(request.binding.clause.settings);
  if (!settings.success) {
    return { outcome: "failed", error: { kind: "piece-invalid", pieceRoot: request.binding.clause.pieceRoot, detail: z.prettifyError(settings.error) } };
  }
  return {
    outcome: "ok",
    value: request.checks
      .filter((check) => runsOnEslint({ check }) === "eslint" && sameClauseAddress({ left: check.clause, right: request.binding.clause.address }) === "same")
      .map((check) => ({ symptom: check.symptom.name, ruleId: checkRuleIdOf({ check }), options: ruleOptionsOf({ settings: settings.data }) })),
  };
};

export const projectedChecksOf = (request: {
  readonly checks: readonly RuledCheck[];
  readonly bindings: readonly ProjectedBinding[];
}): Result<readonly ProjectedCheck[], PieceInvalid> => {
  const projected = gatheredOutcomes({
    outcomes: request.bindings
      .filter((binding) => binding.mechanism === ESLINT_MECHANISM)
      .map((binding) => projectedChecksOfBinding({ checks: request.checks, binding })),
  });
  return projected.outcome === "failed" ? projected : { outcome: "ok", value: projected.value.flat() };
};

export const checksPluginImportOf = (request: {
  readonly path: PathPort;
  readonly importingDirectory: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly install: CoreInstall;
}): PluginImport =>
  request.install.form === "package"
    ? { placement: "importable", specifier: `${request.install.name}/${PLUGIN_EXPORT}` }
    : pluginImportOf({ ...request, pieceRoot: request.installRoot, pluginModule: PLUGIN_SOURCE });
