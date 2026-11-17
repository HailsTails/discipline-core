import type { ClauseAddress } from "../../../core/values/clause-address.ts";
import { TOOL_IDENTITY } from "../../../core/values/tool-identity.ts";

const NAMESPACE_SEPARATOR = "-";

const claimedBy = (request: { readonly owner: string; readonly pluginNamespace: string }): boolean =>
  request.pluginNamespace === request.owner ||
  request.pluginNamespace.startsWith(`${request.owner}${NAMESPACE_SEPARATOR}`);

export const namespaceOwnershipRefusal = (request: {
  readonly address: ClauseAddress;
  readonly pluginNamespace: string;
}): string | undefined => {
  if (typeof request.address.ruleSet === "string") {
    return undefined;
  }
  const ruleSetName = request.address.ruleSet.name;
  const permitted = `${ruleSetName} or ${ruleSetName}${NAMESPACE_SEPARATOR}<name>`;
  if (claimedBy({ owner: TOOL_IDENTITY.ownRuleSet, pluginNamespace: request.pluginNamespace })) {
    return `the plugin namespace ${request.pluginNamespace} belongs to ${TOOL_IDENTITY.name}; the rule set ${ruleSetName} must use ${permitted}`;
  }
  return claimedBy({ owner: ruleSetName, pluginNamespace: request.pluginNamespace })
    ? undefined
    : `the plugin namespace ${request.pluginNamespace} is not owned by the rule set ${ruleSetName}; use ${permitted}`;
};
