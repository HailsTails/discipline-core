import type { EslintConfigLookup } from "../core/values/eslint-config-lookup.ts";
import type { EslintMajorBoundary, ReportData } from "../mechanisms/eslint/runner/eslint-major-boundary.ts";

export const boundaryReporting = (request: { readonly data: ReportData | undefined }): EslintMajorBoundary => ({
  nearestLookup: { flags: [] },
  lookupSelectedBy: () => "nearest-to-file",
  reportDataOf: () => request.data,
});

export const boundaryWithLookupFlags = (request: { readonly flags: readonly string[] }): EslintMajorBoundary => ({
  nearestLookup: { flags: request.flags },
  lookupSelectedBy: () => "nearest-to-file",
  reportDataOf: () => undefined,
});

export const boundarySelectingLookup = (request: { readonly lookup: EslintConfigLookup }): EslintMajorBoundary => ({
  nearestLookup: { flags: [] },
  lookupSelectedBy: () => request.lookup,
  reportDataOf: () => undefined,
});

export const boundaryNearestOnFlag = (request: { readonly flag: string }): EslintMajorBoundary => ({
  nearestLookup: { flags: [request.flag] },
  lookupSelectedBy: ({ flags }) => (flags.includes(request.flag) ? "nearest-to-file" : "repository-root"),
  reportDataOf: () => undefined,
});

export const SILENT_BOUNDARY: EslintMajorBoundary = boundaryReporting({ data: undefined });
