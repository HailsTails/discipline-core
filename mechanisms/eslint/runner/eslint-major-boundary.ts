import type { EslintConfigLookup } from "../../../core/values/eslint-config-lookup.ts";
import type { Rule } from "./eslint-instance.ts";

export type ReportDataValue = string | number | bigint | boolean | null | undefined;

export type ReportData = Readonly<Record<string, ReportDataValue>>;

export type NearestLookupOptions = { readonly flags: readonly string[] };

export type EslintMajorBoundary = {
  readonly nearestLookup: NearestLookupOptions;
  readonly lookupSelectedBy: (request: { readonly flags: readonly string[] }) => EslintConfigLookup;
  readonly reportDataOf: (request: { readonly descriptor: Rule.ReportDescriptor }) => ReportData | undefined;
};
