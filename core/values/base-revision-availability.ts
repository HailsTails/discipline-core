export type BaseRevisionAvailability =
  | { readonly state: "not-given" }
  | { readonly state: "not-found"; readonly revision: string }
  | { readonly state: "git-failed"; readonly revision: string; readonly gitMessage: string };

export type ChangeSetBase =
  | BaseRevisionAvailability
  | { readonly state: "no-merge-base"; readonly revision: string; readonly clone: "shallow" | "complete" };
