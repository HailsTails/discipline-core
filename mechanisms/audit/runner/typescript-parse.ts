import type typescript from "typescript";

export type SyntaxApi = typeof typescript;
export type SyntaxTree = typescript.SourceFile;
export type SyntaxNode = typescript.Node;
export type CommentRange = typescript.CommentRange;

export type TypeScriptParsePort = {
  readonly syntaxApi: SyntaxApi;
  readonly parse: (request: { readonly fileName: string; readonly source: string }) => SyntaxTree;
  readonly children: (request: { readonly node: SyntaxNode }) => readonly SyntaxNode[];
};

export type TypeScriptModules = { readonly typescript: () => Promise<{ readonly default: SyntaxApi }> };

export const defaultTypeScriptModules: TypeScriptModules = { typescript: () => import("typescript") };

const directChildren = (request: { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode }): readonly SyntaxNode[] => {
  const collected: SyntaxNode[] = [];
  request.syntaxApi.forEachChild(request.node, (child) => {
    collected.push(child);
  });
  return collected;
};

export const createParsePort = (options: { readonly syntaxApi: SyntaxApi }): TypeScriptParsePort => ({
  syntaxApi: options.syntaxApi,
  parse: (request) =>
    options.syntaxApi.createSourceFile(request.fileName, request.source, options.syntaxApi.ScriptTarget.Latest, true),
  children: (request) => directChildren({ syntaxApi: options.syntaxApi, node: request.node }),
});
