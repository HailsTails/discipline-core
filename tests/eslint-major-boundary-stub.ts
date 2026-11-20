import type { EslintMajorBoundary, ReportData } from "../mechanisms/eslint/runner/eslint-major-boundary.ts";

export const boundaryReporting = (request: { readonly data: ReportData | undefined }): EslintMajorBoundary => ({
  nearestLookup: { flags: [] },
  reportDataOf: () => request.data,
});

export const boundaryWithLookupFlags = (request: { readonly flags: readonly string[] }): EslintMajorBoundary => ({
  nearestLookup: { flags: request.flags },
  reportDataOf: () => undefined,
});

export const SILENT_BOUNDARY: EslintMajorBoundary = boundaryReporting({ data: undefined });
