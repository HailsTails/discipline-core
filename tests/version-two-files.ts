import type { SettingsWire } from "../core/settings/settings-file.ts";

const VERSION_TWO = 2;

const JSON_INDENT = 2;

export const settingsTextOf = (request: { readonly checks: SettingsWire["checks"]; readonly exclude: readonly string[] }): string => {
  const settings: SettingsWire = { version: VERSION_TWO, ruleSets: {}, checks: request.checks, exclude: request.exclude };
  return `${JSON.stringify(settings, null, JSON_INDENT)}\n`;
};
