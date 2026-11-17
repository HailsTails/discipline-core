import type { Branded } from "./branded.ts";

export type AbsolutePath = Branded<string, "AbsolutePath">;

export const POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT = /^(?:\/|[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+[\\/])/;

export const isAbsolutePath = (text: string): text is AbsolutePath => POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT.test(text);
