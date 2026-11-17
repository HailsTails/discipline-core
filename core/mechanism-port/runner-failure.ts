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

export const runnerInvalidOutput = (request: {
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "runner-invalid-output", detail: request.detail },
});

const thrownMessage = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

export const rejectedCall = (request: {
  readonly thrown: unknown;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } =>
  runnerInvalidOutput({ detail: `the runner call threw or rejected: ${thrownMessage(request)}` });
