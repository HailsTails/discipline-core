import type { NamedBan } from "../symptom-catalogue/symptom-catalogue.ts";

export type BanStanding = "banned" | "not-banned";

const SCOPE_MARK = "@";

const SCOPED_NAME_SEGMENTS = 2;

const UNSCOPED_NAME_SEGMENTS = 1;

export const dependencyOf = (request: { readonly specifier: string }): string => {
  const nameSegments = request.specifier.startsWith(SCOPE_MARK) ? SCOPED_NAME_SEGMENTS : UNSCOPED_NAME_SEGMENTS;
  return request.specifier.split("/").slice(0, nameSegments).join("/");
};

export const banStandingOf = (request: { readonly namedBans: readonly NamedBan[]; readonly dependency: string }): BanStanding =>
  request.namedBans.some((ban) => ban.outsideDependency === request.dependency) ? "banned" : "not-banned";
