import type { RepoPath } from "../values/repo-path-types.ts";

export type PeerKind = "required" | "optional";

export type RunnerFailure =
  | { readonly kind: "piece-invalid"; readonly pieceRoot: string; readonly detail: string }
  | { readonly kind: "tool-failed"; readonly detail: string }
  | { readonly kind: "file-unreadable"; readonly file: RepoPath; readonly detail: string }
  | { readonly kind: "plugin-conflict"; readonly detail: string }
  | { readonly kind: "team-config-unloadable"; readonly detail: string }
  | { readonly kind: "runner-invalid-output"; readonly detail: string }
  | { readonly kind: "file-unparseable"; readonly file: RepoPath; readonly detail: string }
  | {
      readonly kind: "toolchain-unavailable";
      readonly packageName: string;
      readonly peer: PeerKind;
      readonly supported: string;
      readonly found: string;
    }
  | {
      readonly kind: "toolchain-shadowed";
      readonly packageName: string;
      readonly location: string;
      readonly installRoot: string;
    };
