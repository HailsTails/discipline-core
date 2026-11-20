import type { EslintMajorBoundary } from "../eslint-major-boundary.ts";

export const eslintBoundary: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  reportDataOf: (request) => request.descriptor.data,
};
