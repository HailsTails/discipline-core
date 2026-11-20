import { z } from "zod";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import { pieceFilePath } from "../../../core/rule-set-reader/rule-set-reader.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import type { DisciplineId } from "../../../core/values/identifiers.ts";
import { mechanismIdSchema } from "../../../core/values/identifiers.ts";
import { parsedJson } from "../../../core/values/parsed-json.ts";
import { TOOL_IDENTITY } from "../../../core/values/tool-identity.ts";
import { type RuledCheck, runsOnEslint } from "./check-rule-id.ts";
import { type ChecksPlugin, checksPluginOf, type PieceSource } from "./checks-plugin.ts";
import { eslintPluginModuleSchema } from "./eslint-plugin-schema.ts";

export type HonePluginSources = {
  readonly checks: readonly RuledCheck[];
  readonly installRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly modules: ModuleLoaderPort;
};

const ESLINT = mechanismIdSchema.parse("eslint");

const pluginModulesSchema = z.looseObject({ clauses: z.array(z.looseObject({ settings: z.looseObject({ pluginModule: z.string() }) })) });

const eslintDisciplinesOf = (request: { readonly checks: readonly RuledCheck[] }): readonly DisciplineId[] => [
  ...new Set(
    request.checks
      .filter((check) => runsOnEslint({ check }) === "eslint" && check.clause.ruleSet === TOOL_IDENTITY.ownRuleSet)
      .map((check) => check.clause.discipline),
  ),
];

const pieceDocumentAt = (request: HonePluginSources & { readonly discipline: DisciplineId }): unknown => {
  const text = request.fileText.read({
    path: pieceFilePath({ path: request.path, ruleSetRoot: request.installRoot, mechanism: ESLINT, discipline: request.discipline }),
  });
  const document = text.outcome === "ok" ? parsedJson({ text: text.value }) : text;
  return document.outcome === "ok" ? document.value : undefined;
};

const loadedPlugin = async (request: HonePluginSources & { readonly pieceRoot: string; readonly pluginModule: string }): Promise<unknown> => {
  const loaded = await request.modules.load({ path: request.path.join({ segments: [request.pieceRoot, request.pluginModule] }) });
  const plugin = eslintPluginModuleSchema.safeParse(loaded.outcome === "ok" ? loaded.value : undefined);
  return plugin.success ? plugin.data.default : undefined;
};

const pieceSourcesOf = async (request: HonePluginSources & { readonly discipline: DisciplineId }): Promise<readonly PieceSource[]> => {
  const piece = pieceDocumentAt(request);
  const pluginModules = pluginModulesSchema.safeParse(piece);
  if (!pluginModules.success) {
    return [];
  }
  const pieceRoot = request.path.join({ segments: [request.installRoot, "mechanisms", ESLINT, request.discipline] });
  return Promise.all(
    [...new Set(pluginModules.data.clauses.map((entry) => entry.settings.pluginModule))].map(async (pluginModule) => ({
      piece,
      plugin: await loadedPlugin({ ...request, pieceRoot, pluginModule }),
    })),
  );
};

export const honePluginAt = async (request: HonePluginSources): Promise<ChecksPlugin> => {
  const sources = await Promise.all(eslintDisciplinesOf(request).map((discipline) => pieceSourcesOf({ ...request, discipline })));
  return checksPluginOf({ checks: request.checks, sources: sources.flat() });
};
