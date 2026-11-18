import type { RepoPath } from "../../../core/values/repo-path-types.ts";
import type { WalkerDisk } from "../runner/walker-piece.ts";
import type { SyntaxApi } from "../runner/typescript-parse.ts";

export type StrictOption =
  | "strict"
  | "noUncheckedIndexedAccess"
  | "exactOptionalPropertyTypes"
  | "noImplicitOverride"
  | "noFallthroughCasesInSwitch"
  | "noPropertyAccessFromIndexSignature"
  | "useUnknownInCatchVariables";

export type OptionState = "on" | "off";

export type OptionSetting = OptionState | "unset";

export type OptionSettings = Readonly<Record<StrictOption, OptionSetting>>;

export type BaseConfig = { readonly file: string; readonly settings: OptionSettings };

export type ResolvedConfig =
  | { readonly kind: "resolved"; readonly effective: Readonly<Record<StrictOption, OptionState>>; readonly bases: readonly BaseConfig[] }
  | { readonly kind: "unresolved"; readonly detail: string };

export type CompilerOptionsResolution = {
  readonly resolve: (request: { readonly file: RepoPath }) => ResolvedConfig;
};

export type CompilerOptionsResolutionOf = (request: { readonly syntaxApi: SyntaxApi; readonly disk: WalkerDisk }) => CompilerOptionsResolution;
