import type { ClauseAddress } from "../../../core/values/clause-address.ts";
import { TOOL_IDENTITY } from "../../../core/values/tool-identity.ts";

const NAMESPACE_SEPARATOR = "-";

const belongsToTool = (request: { readonly pluginNamespace: string }): boolean =>
  request.pluginNamespace === TOOL_IDENTITY.command ||
  request.pluginNamespace.startsWith(`${TOOL_IDENTITY.command}${NAMESPACE_SEPARATOR}`);

const ownedBy = (request: { readonly ruleSetName: string; readonly pluginNamespace: string }): boolean =>
  request.pluginNamespace === request.ruleSetName ||
  request.pluginNamespace.startsWith(`${request.ruleSetName}${NAMESPACE_SEPARATOR}`);

export const namespaceOwnershipRefusal = (request: {
  readonly address: ClauseAddress;
  readonly pluginNamespace: string;
}): string | undefined => {
  if (typeof request.address.ruleSet === "string") {
    return undefined;
  }
  const ruleSetName: string = request.address.ruleSet.name;
  const permitted = `${ruleSetName} or ${ruleSetName}${NAMESPACE_SEPARATOR}<name>`;
  if (belongsToTool({ pluginNamespace: request.pluginNamespace })) {
    return `the plugin namespace ${request.pluginNamespace} belongs to ${TOOL_IDENTITY.name}; the rule set ${ruleSetName} must use ${permitted}`;
  }
  return ownedBy({ ruleSetName, pluginNamespace: request.pluginNamespace })
    ? undefined
    : `the plugin namespace ${request.pluginNamespace} is not owned by the rule set ${ruleSetName}; use ${permitted}`;
};
