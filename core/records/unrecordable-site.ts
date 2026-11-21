import type { NativeException } from "../mechanism-port/runner-result-schema.ts";
import type { RepoPath } from "../values/repo-path.ts";

export type UnrecordableBecause = "no-check" | NativeException["kind"];

export type UnrecordableSite = { readonly address: string; readonly file: RepoPath; readonly because: UnrecordableBecause };
