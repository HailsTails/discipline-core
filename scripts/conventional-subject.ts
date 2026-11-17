import type { Result } from "../core/values/result.ts";

export const CHANGE_TYPES = ["feat", "fix", "perf", "revert", "docs", "refactor", "test", "build", "ci", "chore", "style"] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];

export type Compatibility = "compatible" | "breaking";

export type ConventionalSubject = {
  readonly type: ChangeType;
  readonly scope: string | undefined;
  readonly compatibility: Compatibility;
  readonly description: string;
};

export type SubjectRejection = { readonly kind: "unshaped" } | { readonly kind: "unknown-type"; readonly type: string };

export type ChangeEntry =
  | { readonly kind: "conventional"; readonly subject: ConventionalSubject }
  | { readonly kind: "unclassified"; readonly subject: string };

const SUBJECT_SHAPE = /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9][a-z0-9._/-]*)\))?(?<breaking>!)?: (?<description>\S.*)$/;

const changeTypeOf = (request: { readonly type: string }): ChangeType | undefined => CHANGE_TYPES.find((type) => type === request.type);

export const conventionalSubjectOf = (request: { readonly subject: string }): Result<ConventionalSubject, SubjectRejection> => {
  const groups = SUBJECT_SHAPE.exec(request.subject)?.groups;
  if (groups?.type === undefined || groups.description === undefined) {
    return { outcome: "failed", error: { kind: "unshaped" } };
  }
  const type = changeTypeOf({ type: groups.type });
  if (type === undefined) {
    return { outcome: "failed", error: { kind: "unknown-type", type: groups.type } };
  }
  return {
    outcome: "ok",
    value: {
      type,
      scope: groups.scope,
      compatibility: groups.breaking === undefined ? "compatible" : "breaking",
      description: groups.description,
    },
  };
};

export const changeEntryOf = (request: { readonly subject: string }): ChangeEntry => {
  const conventional = conventionalSubjectOf(request);
  return conventional.outcome === "ok"
    ? { kind: "conventional", subject: conventional.value }
    : { kind: "unclassified", subject: request.subject };
};
