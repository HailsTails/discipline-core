import type { Result } from "../core/values/result.ts";
import {
  type DeclarationEmit,
  type DeclarationFailure,
  type EmittedDeclaration,
  type PublicTypeEntry,
  publishedDeclarationsOf,
  reachableDeclarations,
  typedExportOf,
} from "../scripts/package-declarations.ts";

export type EntryReach = { readonly reached: readonly string[]; readonly packageImports: readonly string[] };

export type PublicTypeReach = {
  readonly problems: readonly string[];
  readonly entries: Readonly<Record<string, EntryReach>>;
  readonly valueDeclaring: readonly string[];
  readonly zodMentioning: readonly string[];
};

const RELATIVE_SPECIFIER = /^\.\.?\//;

const EXPORTED_VALUE = /^export\s+(?:declare\s+)?(?:const|let|var|function|class|enum|default)\b/m;

const DECLARATION_FILE = /\.d\.ts$/;

const entryReachOf = (request: { readonly declarations: readonly EmittedDeclaration[]; readonly entry: PublicTypeEntry }): EntryReach => {
  const reached = reachableDeclarations({ declarations: request.declarations, roots: [typedExportOf({ entry: request.entry }).declaration] });
  const packageImports = request.declarations
    .filter((declaration) => reached.includes(declaration.path))
    .flatMap((declaration) => declaration.specifiers.filter((specifier) => !RELATIVE_SPECIFIER.test(specifier)));
  return { reached, packageImports: [...new Set(packageImports)].sort() };
};

const reachOfEmit = (request: {
  readonly emit: DeclarationEmit;
  readonly entries: readonly PublicTypeEntry[];
  readonly requiredPeers: readonly string[];
}): PublicTypeReach => {
  const published = publishedDeclarationsOf(request);
  const shipped = published.outcome === "ok" ? published.value.filter((file) => DECLARATION_FILE.test(file.path)) : [];
  return {
    problems: published.outcome === "failed" ? published.error : [],
    entries: Object.fromEntries(request.entries.map((entry) => [entry.subpath, entryReachOf({ declarations: request.emit.declarations, entry })])),
    valueDeclaring: shipped.filter((file) => EXPORTED_VALUE.test(file.text)).map((file) => file.path),
    zodMentioning: shipped.filter((file) => file.text.includes("zod")).map((file) => file.path),
  };
};

export const publicTypeReachOf = (request: {
  readonly emitted: Result<DeclarationEmit, DeclarationFailure>;
  readonly entries: readonly PublicTypeEntry[];
  readonly requiredPeers: readonly string[];
}): PublicTypeReach =>
  request.emitted.outcome === "failed"
    ? { problems: [request.emitted.error.detail], entries: {}, valueDeclaring: [], zodMentioning: [] }
    : reachOfEmit({ emit: request.emitted.value, entries: request.entries, requiredPeers: request.requiredPeers });
