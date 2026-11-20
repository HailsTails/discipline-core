import { createDefaultTypeScriptDeclarationPort } from "../scripts/typescript-declaration-port.ts";
import { defaultParsePort } from "./typescript-parse-port.ts";

export type EslintLine = "eslint" | "eslint-9";

export const ESLINT_LINES: readonly EslintLine[] = ["eslint", "eslint-9"];

export type ConsumerFiles = Readonly<Record<string, string>>;

type ConsumerForm = "typescript" | "checked-javascript";

const syntaxApi = defaultParsePort.syntaxApi;

const SLASH = "/";

const ROOT = syntaxApi.sys.resolvePath(`${import.meta.dirname}/..`).replaceAll(String.fromCharCode(92), SLASH);

const CONSUMER_ROOT = `${ROOT}/.consumer`;

const SHIPPED_ROOT = `${ROOT}/.shipped`;

const PLUGIN_ENTRY = "api/eslint-plugin.ts";

const PLUGIN_SPECIFIER = "@hailstails/hone/eslint-plugin";

const NEW_LINE = "\n";

const emitted = await createDefaultTypeScriptDeclarationPort({}).emit({ sourceRoot: ROOT, entryPoints: [PLUGIN_ENTRY] });

const shippedFiles: ReadonlyMap<string, string> = new Map(
  emitted.outcome === "ok" ? emitted.value.declarations.map((declaration) => [`${SHIPPED_ROOT}/${declaration.path}`, declaration.text]) : [],
);

export const shippedDeclarationDiagnostics: readonly string[] = emitted.outcome === "ok" ? emitted.value.diagnostics : [emitted.error.detail];

const typeFileOf = (request: { readonly line: EslintLine; readonly file: string }): string => `${ROOT}/node_modules/${request.line}/lib/types/${request.file}`;

const optionsOn = (request: { readonly line: EslintLine; readonly form: ConsumerForm }) => ({
  strict: true,
  noEmit: true,
  skipLibCheck: false,
  target: syntaxApi.ScriptTarget.ESNext,
  module: syntaxApi.ModuleKind.ESNext,
  moduleResolution: syntaxApi.ModuleResolutionKind.Bundler,
  types: [],
  allowJs: request.form === "checked-javascript",
  checkJs: request.form === "checked-javascript",
  paths: {
    eslint: [typeFileOf({ line: request.line, file: "index.d.ts" })],
    "eslint/config": [typeFileOf({ line: request.line, file: "config-api.d.ts" })],
    [PLUGIN_SPECIFIER]: [`${SHIPPED_ROOT}/api/eslint-plugin.d.ts`],
  },
});

const textOf = (request: { readonly files: ConsumerFiles; readonly file: string }): string | undefined =>
  request.file.startsWith(`${CONSUMER_ROOT}/`) ? request.files[request.file.slice(CONSUMER_ROOT.length + 1)] : shippedFiles.get(request.file);

export const consumerDiagnosticsOn = (request: {
  readonly line: EslintLine;
  readonly form: ConsumerForm;
  readonly files: ConsumerFiles;
  readonly entry: string;
}): readonly string[] => {
  const options = optionsOn(request);
  const host = syntaxApi.createCompilerHost(options);
  const program = syntaxApi.createProgram({
    rootNames: [`${CONSUMER_ROOT}/${request.entry}`],
    options,
    host: {
      ...host,
      fileExists: (file) => textOf({ files: request.files, file }) !== undefined || host.fileExists(file),
      directoryExists: (directory) => [CONSUMER_ROOT, SHIPPED_ROOT].some((root) => directory === root || directory.startsWith(`${root}/`)) || host.directoryExists?.(directory) === true,
      readFile: (file) => textOf({ files: request.files, file }) ?? host.readFile(file),
      getSourceFile: (file, languageVersion) => {
        const text = textOf({ files: request.files, file });
        return text === undefined ? host.getSourceFile(file, languageVersion) : syntaxApi.createSourceFile(file, text, languageVersion, true);
      },
    },
  });
  return syntaxApi
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => syntaxApi.flattenDiagnosticMessageText(diagnostic.messageText, NEW_LINE).split(NEW_LINE)[0] ?? "");
};
