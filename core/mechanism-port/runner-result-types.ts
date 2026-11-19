import type { Anchor } from "../values/anchor.ts";
import type { ClauseAddress } from "../values/clause-address-types.ts";
import type { RepoPath } from "../values/repo-path-types.ts";

export type Remedy = {
  readonly fix: string;
  readonly page: string;
  readonly section: string;
};

export type Hit = {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
  readonly anchor: Anchor;
  readonly snippet: string;
  readonly remedy?: Remedy;
};
