import type { EslintMajorBoundary } from "../eslint-major-boundary.ts";

export const eslintBoundary: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  lookupSelectedBy: () => "nearest-to-file",
  reportDataOf: (request) => request.descriptor.data,
};
