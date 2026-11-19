import type { StandaloneRunner } from "../core/mechanism-port/runner-module-schema.ts";
import type { RunnerClause } from "../core/mechanism-port/runner-module-types.ts";
import { createDefaultEntryKindPort } from "../core/platform-ports/file-system-port.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { SourceCase } from "../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import { createWalkerRunner } from "../mechanisms/audit/runner/create-walker-runner.ts";
import type { CompilerOptions, SyntaxApi, TypeScriptParsePort } from "../mechanisms/audit/runner/typescript-parse.ts";
import type { AllowedFormSection } from "./allowed-forms-page.ts";
import { overlaidFileText } from "./overlaid-file-text.ts";

export const repositoryRootOf = (request: { readonly testFolder: string }): string =>
  createDefaultPathPort({}).join({ segments: [request.testFolder, ".."] });

export const cd27ChecksPageOf = (request: { readonly repoRoot: string }): string => {
  const page = createDefaultFileTextPort({}).read({
    path: createDefaultPathPort({}).join({ segments: [request.repoRoot, "rules", "CD-27", "CHECKS.md"] }),
  });
  return page.outcome === "ok" ? page.value : "";
};

export const FORM_FILE = repoPathSchema.parse("allowed-form.test.ts");

export const VITEST_PRELUDE = "import { assert, expect, it, vi } from \"vitest\";\n";

const cd3CompilerOptionsOf = (request: { readonly syntaxApi: SyntaxApi }): CompilerOptions => ({
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  noPropertyAccessFromIndexSignature: true,
  useUnknownInCatchVariables: true,
  target: request.syntaxApi.ScriptTarget.ESNext,
  module: request.syntaxApi.ModuleKind.ESNext,
  moduleResolution: request.syntaxApi.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
  noEmit: true,
  types: [],
});

export type AllowedBlock = { readonly name: string; readonly source: string };

export const sectionNamesOf = (request: { readonly sections: readonly AllowedFormSection[] }): readonly string[] =>
  request.sections.map((section) => section.section);

export const allowedBlocksOf = (request: { readonly sections: readonly AllowedFormSection[] }): readonly AllowedBlock[] =>
  request.sections.flatMap((section) =>
    section.allowed.map((source, index) => ({ name: `${section.section} ${index + 1}`, source })),
  );

export const allowCasesOf = (request: { readonly blocks: readonly AllowedBlock[] }): readonly SourceCase[] =>
  request.blocks.map((block) => ({
    name: block.name,
    fileName: FORM_FILE,
    source: `${VITEST_PRELUDE}${block.source}`,
    expectedLines: [],
  }));

export const rowsNamed = <Row extends { readonly name: string }>(request: {
  readonly rows: readonly Row[];
  readonly names: readonly string[];
}): readonly Row[] => request.rows.filter((row) => request.names.includes(row.name));

export const typeErrorsOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly repoRoot: string;
  readonly source: string;
}): readonly string[] => {
  const { syntaxApi } = request;
  const options = cd3CompilerOptionsOf({ syntaxApi });
  const formPath = `${request.repoRoot.replaceAll("\\", "/")}/${FORM_FILE}`;
  const host = syntaxApi.createCompilerHost(options);
  const formText = `${VITEST_PRELUDE}${request.source}`;
  const readFile = host.readFile;
  const getSourceFile = host.getSourceFile;
  const program = syntaxApi.createProgram({
    rootNames: [formPath],
    options,
    host: {
      ...host,
      fileExists: (fileName) => fileName.replaceAll("\\", "/") === formPath || host.fileExists(fileName),
      readFile: (fileName) => (fileName.replaceAll("\\", "/") === formPath ? formText : readFile(fileName)),
      getSourceFile: (fileName, languageVersion) =>
        fileName.replaceAll("\\", "/") === formPath
          ? syntaxApi.createSourceFile(fileName, formText, languageVersion, true)
          : getSourceFile(fileName, languageVersion),
    },
  });
  return syntaxApi
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => syntaxApi.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
};

export const remedySectionsOf = async (request: {
  readonly repoRoot: string;
  readonly parse: TypeScriptParsePort;
  readonly clause: RunnerClause;
  readonly source: string;
}): Promise<readonly string[]> => {
  const path = createDefaultPathPort({});
  const repoRoot = absolutePathSchema.parse(request.repoRoot);
  const runner: StandaloneRunner = createWalkerRunner({
    fileText: overlaidFileText({
      base: createDefaultFileTextPort({}),
      files: { [path.join({ segments: [repoRoot, FORM_FILE] })]: `${VITEST_PRELUDE}${request.source}` },
    }),
    modules: createDefaultModuleLoaderPort({}),
    path,
    parse: request.parse,
    entryKind: createDefaultEntryKindPort({}),
  });
  const report = await runner.run({ repoRoot, installRoot: repoRoot, files: [FORM_FILE], trackedPaths: [FORM_FILE], clauses: [request.clause] });
  if (report.outcome === "failed") return [`run failed: ${report.error.kind}`];
  return report.value.hits.flatMap((hit) => (hit.remedy === undefined ? [] : [hit.remedy.section]));
};
