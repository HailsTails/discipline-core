import { installRootOfApiEntry } from "../core/check/install-root.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createSymptomCatalogueRepository } from "../core/symptom-catalogue/read-symptom-catalogue.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { checksPluginOf } from "../mechanisms/eslint/runner/checks-plugin.ts";
import { honePluginAt } from "../mechanisms/eslint/runner/hone-plugin.ts";

export type HonePlugin = { readonly meta: { readonly name: string; readonly version: string }; readonly rules: Readonly<Record<string, object>> };

const EMPTY_PLUGIN: HonePlugin = checksPluginOf({ checks: [], sources: [] });

const path = createDefaultPathPort({});

const installRoot = installRootOfApiEntry({ path, moduleUrl: import.meta.url });

const fileText = createDefaultFileTextPort({});

const pluginAt = async (request: { readonly installRoot: AbsolutePath }): Promise<HonePlugin> => {
  const catalogue = createSymptomCatalogueRepository({ fileText, path, ruleSetRoot: request.installRoot }).read({});
  const checks = catalogue.outcome === "ok" && catalogue.value.held === "catalogue" ? catalogue.value.catalogue.checks : [];
  return honePluginAt({ checks, installRoot: request.installRoot, fileText, path, modules: createDefaultModuleLoaderPort({}) });
};

const plugin: HonePlugin = installRoot.outcome === "ok" ? await pluginAt({ installRoot: installRoot.value }) : EMPTY_PLUGIN;

export default plugin;