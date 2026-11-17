import { createConformanceTesting } from "../core/conformance/conformance-testing.ts";
import type { ClauseConformanceOf, ClauseUnderTestOf, RepoPathOf } from "../core/conformance/conformance-testing-types.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { mechanismIdSchema } from "../core/values/identifiers.ts";

export type {
  CaseUnderTest,
  ClauseRequest,
  ClauseUnderTest,
  ConformanceFailure,
  ConformanceSetupFailure,
  ConformanceSetupFailureKind,
} from "../core/conformance/conformance-testing-types.ts";

const testing = createConformanceTesting({
  mechanism: mechanismIdSchema.parse("audit"),
  moduleUrl: import.meta.url,
  fileText: createDefaultFileTextPort({}),
  path: createDefaultPathPort({}),
  modules: createDefaultModuleLoaderPort({}),
});

export const clauseConformanceOf: ClauseConformanceOf = testing.clauseConformanceOf;

export const clauseUnderTestOf: ClauseUnderTestOf = testing.clauseUnderTestOf;

export const repoPathOf: RepoPathOf = testing.repoPathOf;
