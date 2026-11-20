import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import type { Why } from "../values/why-chain.ts";
import type { AuthoriseRequest } from "./authorising.ts";

export type AuthoriseOptionName = "repo" | "symptom" | "file" | "case" | "owes" | "why" | "because" | "evidence" | "rootCause" | "rootCheck" | "readback" | "owner";

export const AUTHORISE_OPTIONS: Readonly<Record<AuthoriseOptionName, string>> = {
  repo: "--repo",
  symptom: "--symptom",
  file: "--file",
  case: "--case",
  owes: "--owes",
  why: "--why",
  because: "--because",
  evidence: "--evidence",
  rootCause: "--root-cause",
  rootCheck: "--root-check",
  readback: "--readback",
  owner: "--owner",
};

export type AuthoriseArgumentsInvalid = { readonly kind: "arguments-invalid"; readonly detail: string };

export type OptionValues = ReadonlyMap<string, readonly string[]>;

type Read<Value> = Result<Value, AuthoriseArgumentsInvalid>;

type Reading = { readonly values: OptionValues };

const COMMAND = "hone authorise";

const invalid = (request: { readonly detail: string }): Read<never> => ({
  outcome: "failed",
  error: { kind: "arguments-invalid", detail: `${COMMAND} ${request.detail}` },
});

const onceOf = (request: Reading & { readonly option: AuthoriseOptionName }): Read<string> => {
  const name = AUTHORISE_OPTIONS[request.option];
  const [only, ...rest] = request.values.get(name) ?? [];
  if (only === undefined) {
    return invalid({ detail: `needs ${name}` });
  }
  return rest.length > 0 ? invalid({ detail: `takes ${name} once` }) : { outcome: "ok", value: only };
};

const whysOf = (request: Reading): Read<readonly Why[]> => {
  const questions = request.values.get(AUTHORISE_OPTIONS.why) ?? [];
  const answers = request.values.get(AUTHORISE_OPTIONS.because) ?? [];
  const evidence = request.values.get(AUTHORISE_OPTIONS.evidence) ?? [];
  if (questions.length !== answers.length || questions.length !== evidence.length) {
    return invalid({
      detail: `needs ${AUTHORISE_OPTIONS.why}, ${AUTHORISE_OPTIONS.because} and ${AUTHORISE_OPTIONS.evidence} the same number of times, one of each for every why`,
    });
  }
  return { outcome: "ok", value: questions.map((why, position) => ({ why, because: answers[position] ?? "", evidence: evidence[position] ?? "" })) };
};

const fileOf = (request: Reading): Read<RepoPath> => {
  const given = onceOf({ ...request, option: "file" });
  if (given.outcome === "failed") {
    return given;
  }
  const file = repoPathSchema.safeParse(given.value);
  return file.success
    ? { outcome: "ok", value: file.data }
    : invalid({ detail: `takes one file inside the repository, written relative to it, for ${AUTHORISE_OPTIONS.file}, not ${JSON.stringify(given.value)}` });
};

type Site = Pick<AuthoriseRequest, "symptom" | "case" | "owes" | "owner">;

type Root = Pick<AuthoriseRequest, "rootCause" | "rootCheck" | "readback">;

const siteOf = (request: Reading): Read<Site> => {
  const symptom = onceOf({ ...request, option: "symptom" });
  const caseName = onceOf({ ...request, option: "case" });
  const owes = onceOf({ ...request, option: "owes" });
  const owner = onceOf({ ...request, option: "owner" });
  if (symptom.outcome === "failed") {
    return symptom;
  }
  if (caseName.outcome === "failed") {
    return caseName;
  }
  if (owes.outcome === "failed") {
    return owes;
  }
  return owner.outcome === "failed" ? owner : { outcome: "ok", value: { symptom: symptom.value, case: caseName.value, owes: owes.value, owner: owner.value } };
};

const rootOf = (request: Reading): Read<Root> => {
  const rootCause = onceOf({ ...request, option: "rootCause" });
  const rootCheck = onceOf({ ...request, option: "rootCheck" });
  const readback = onceOf({ ...request, option: "readback" });
  if (rootCause.outcome === "failed") {
    return rootCause;
  }
  if (rootCheck.outcome === "failed") {
    return rootCheck;
  }
  return readback.outcome === "failed" ? readback : { outcome: "ok", value: { rootCause: rootCause.value, rootCheck: rootCheck.value, readback: readback.value } };
};

export const authoriseRequestOf = (request: Reading): Read<AuthoriseRequest> => {
  const site = siteOf(request);
  const file = fileOf(request);
  const root = rootOf(request);
  const whys = whysOf(request);
  if (site.outcome === "failed") {
    return site;
  }
  if (file.outcome === "failed") {
    return file;
  }
  if (root.outcome === "failed") {
    return root;
  }
  return whys.outcome === "failed" ? whys : { outcome: "ok", value: { ...site.value, ...root.value, file: file.value, whys: whys.value } };
};
