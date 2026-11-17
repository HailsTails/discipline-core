import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { ConfigFileSearch, EslintPort, QueryInstance } from "./eslint-instance.ts";
import { repoPathResolved, type ScriptOption } from "./package-script-scanner.ts";

export type OptionVerdict = "weakens" | "weakens-nothing";

export type ScriptOptionJudge = (request: {
  readonly option: ScriptOption;
}) => Promise<Result<OptionVerdict, RunnerFailure>>;

type JudgeContext = {
  readonly query: Pick<QueryInstance, "configFileOf">;
  readonly eslint: Pick<EslintPort, "ignoredByPatterns">;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly checked: readonly RepoPath[];
};

const WEAKENS: Result<OptionVerdict, RunnerFailure> = { outcome: "ok", value: "weakens" };

const WEAKENS_NOTHING: Result<OptionVerdict, RunnerFailure> = { outcome: "ok", value: "weakens-nothing" };

const folderSegmentsOf = (request: { readonly location: RepoPath }): readonly string[] =>
  request.location.split("/").slice(0, -1);

const checkedWithin = (request: {
  readonly checked: readonly RepoPath[];
  readonly folderSegments: readonly string[];
}): readonly RepoPath[] => {
  const folder = request.folderSegments.join("/");
  return request.checked.filter((file) => folder === "" || file.startsWith(`${folder}/`));
};

const resolvesTo = (request: {
  readonly search: ConfigFileSearch;
  readonly config: RepoPath;
  readonly context: JudgeContext;
}): "same-config" | "other-config" => {
  if (request.search.kind !== "found") return "other-config";
  const location = request.context.path.relative({ from: request.context.repoRoot, to: request.search.path });
  return location.relation === "within-root" && location.path === request.config ? "same-config" : "other-config";
};

const configVerdict = (request: { readonly context: JudgeContext; readonly location: RepoPath; readonly config: string }): Promise<Result<OptionVerdict, RunnerFailure>> => {
  const folderSegments = folderSegmentsOf(request);
  const config = repoPathResolved({ baseSegments: folderSegments, path: request.config });
  if (config.outcome === "failed") return Promise.resolve(WEAKENS);
  return Promise.all(
    checkedWithin({ checked: request.context.checked, folderSegments }).map((file) => request.context.query.configFileOf({ file })),
  ).then((searches) =>
    searches.every((search) => resolvesTo({ search, config: config.value, context: request.context }) === "same-config")
      ? WEAKENS_NOTHING
      : WEAKENS,
  );
};

const ignorePatternVerdict = (request: { readonly context: JudgeContext; readonly location: RepoPath; readonly pattern: string }): Promise<Result<OptionVerdict, RunnerFailure>> => {
  const folderSegments = folderSegmentsOf(request);
  const files = checkedWithin({ checked: request.context.checked, folderSegments });
  if (files.length === 0) return Promise.resolve(WEAKENS_NOTHING);
  const cwd = request.context.path.resolve({ path: request.context.path.join({ segments: [request.context.repoRoot, ...folderSegments] }) });
  if (cwd.outcome === "failed") return Promise.resolve(WEAKENS);
  return request.context.eslint
    .ignoredByPatterns({
      cwd: cwd.value,
      patterns: [request.pattern],
      paths: files.map((file) => file.split("/").slice(folderSegments.length).join("/")),
    })
    .then((states) => {
      if (states.outcome === "failed") return states;
      return states.value.includes("ignored") ? WEAKENS : WEAKENS_NOTHING;
    });
};

export const scriptOptionJudge =
  (context: JudgeContext): ScriptOptionJudge =>
  ({ option }) => {
    switch (option.effect.kind) {
      case "weakens":
        return Promise.resolve(WEAKENS);
      case "names-config":
        return configVerdict({ context, location: option.location, config: option.effect.config });
      case "ignores-pattern":
        return ignorePatternVerdict({ context, location: option.location, pattern: option.effect.pattern });
    }
  };
