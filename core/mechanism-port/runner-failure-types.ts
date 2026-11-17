import type { PieceFailure } from "./piece-failure-types.ts";

export type PeerKind = "required" | "optional";

export type RunnerFailure =
  | PieceFailure
  | { readonly kind: "tool-failed"; readonly detail: string }
  | { readonly kind: "plugin-conflict"; readonly detail: string }
  | { readonly kind: "team-config-unloadable"; readonly detail: string }
  | { readonly kind: "runner-invalid-output"; readonly detail: string }
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
