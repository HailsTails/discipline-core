import { createDefaultExecutionPort, type ExecutionPolicy } from "./execution-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";

export type GitFailure = {
  readonly kind: "git-failed";
  readonly command: string;
  readonly detail: string;
};

export type BaseAbsent = { readonly kind: "base-absent" };

export type CloneDepth = "shallow" | "complete";

export type NoMergeBase = { readonly kind: "no-merge-base"; readonly clone: CloneDepth };

export type BaseReadFailure = GitFailure | BaseAbsent;

export type ChangeSetFailure = BaseReadFailure | NoMergeBase;

export type BaseContentMembership = "present-in-base" | "absent-from-base";

export type BaseFileText =
  | { readonly presence: "absent-from-base" }
  | { readonly presence: "present-in-base"; readonly text: string };

export type GitContentQuery = {
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string;
  readonly file: RepoPath;
};

export type GitPort = {
  readonly trackedPaths: (request: {
    readonly repoRoot: AbsolutePath;
  }) => Result<readonly RepoPath[], GitFailure>;
  readonly changedSince: (request: {
    readonly repoRoot: AbsolutePath;
    readonly baseRevision: string;
  }) => Result<readonly RepoPath[], ChangeSetFailure>;
  readonly contentInBase: (request: GitContentQuery) => Result<BaseContentMembership, GitFailure>;
  readonly textInBase: (request: GitContentQuery) => Result<BaseFileText, BaseReadFailure>;
};

export type GitHistoryPort = {
  readonly mergedTags: (request: {
    readonly repoRoot: AbsolutePath;
    readonly pattern: string;
  }) => Result<readonly string[], GitFailure>;
  readonly commitsAfter: (request: {
    readonly repoRoot: AbsolutePath;
    readonly revision: string;
  }) => Result<readonly CommitRecord[], GitFailure>;
};

export type CommitRecord = { readonly parentCount: number; readonly message: string };

export type GitEnvironment = Readonly<Record<string, string | undefined>>;

export type GitRun =
  | {
      readonly outcome: "exited";
      readonly status: number;
      readonly stdout: string;
      readonly stderr: string;
    }
  | { readonly outcome: "errored"; readonly detail: string };

export type GitSpawnRequest = {
  readonly file: string;
  readonly arguments: readonly string[];
  readonly maxBuffer: number;
  readonly environment: GitEnvironment;
};

export type GitSpawn = (request: GitSpawnRequest) => GitRun;

const REPOSITORY_LOCATION_VARIABLES: readonly string[] = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_NAMESPACE",
  "GIT_PREFIX",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_SHALLOW_FILE",
  "GIT_GRAFT_FILE",
];

const LARGEST_GIT_OUTPUT_BYTES = 256 * 1024 * 1024;

const SUCCESSFUL_EXIT_STATUS = 0;

const environmentWithoutRepositoryLocation = (request: {
  readonly ambientEnvironment: GitEnvironment;
}): GitEnvironment =>
  Object.fromEntries(
    Object.entries(request.ambientEnvironment).filter(
      ([name]) => !REPOSITORY_LOCATION_VARIABLES.includes(name),
    ),
  );

const GIT_EXECUTION_POLICY: ExecutionPolicy = {
  executable: "git",
  environment: ({ ambient }) => environmentWithoutRepositoryLocation({ ambientEnvironment: ambient }),
  timeoutMilliseconds: undefined,
  maximumOutputBytes: LARGEST_GIT_OUTPUT_BYTES,
};

const parsedRepoPaths = (request: {
  readonly listed: readonly string[];
}): Result<readonly RepoPath[], string> => {
  const parsed = request.listed.map((text) => ({ text, result: repoPathSchema.safeParse(text) }));
  const refused = parsed.find((entry) => !entry.result.success);
  if (refused !== undefined) {
    return { outcome: "failed", error: refused.text };
  }
  return { outcome: "ok", value: parsed.flatMap((entry) => (entry.result.success ? [entry.result.data] : [])) };
};

const gitOutput = (request: {
  readonly spawn: GitSpawn;
  readonly environment: GitEnvironment;
  readonly repoRoot: AbsolutePath;
  readonly gitArguments: readonly string[];
}): Result<{ readonly command: string; readonly stdout: string }, GitFailure> => {
  const fullArguments = ["-C", request.repoRoot, ...request.gitArguments];
  const command = `git ${fullArguments.join(" ")}`;
  const run = request.spawn({
    file: "git",
    arguments: fullArguments,
    maxBuffer: LARGEST_GIT_OUTPUT_BYTES,
    environment: request.environment,
  });
  if (run.outcome === "errored") {
    return {
      outcome: "failed",
      error: { kind: "git-failed", command, detail: run.detail },
    };
  }
  if (run.status !== SUCCESSFUL_EXIT_STATUS) {
    return {
      outcome: "failed",
      error: { kind: "git-failed", command, detail: run.stderr },
    };
  }
  return { outcome: "ok", value: { command, stdout: run.stdout } };
};

const gitPaths = (request: {
  readonly spawn: GitSpawn;
  readonly environment: GitEnvironment;
  readonly repoRoot: AbsolutePath;
  readonly gitArguments: readonly string[];
}): Result<readonly RepoPath[], GitFailure> => {
  const output = gitOutput(request);
  if (output.outcome === "failed") {
    return output;
  }
  const parsedPaths = parsedRepoPaths({
    listed: output.value.stdout.split("\0").filter((text) => text.length > 0),
  });
  if (parsedPaths.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: output.value.command,
        detail: `git listed a path that is not a repo path: ${parsedPaths.error}`,
      },
    };
  }
  return parsedPaths;
};

type GitContext = {
  readonly spawn: GitSpawn;
  readonly environment: GitEnvironment;
  readonly repoRoot: AbsolutePath;
};

type BaseQuery = GitContext & { readonly baseRevision: string };

type Answer<Value> = { readonly answered: "yes"; readonly value: Value } | { readonly answered: "no" };

const exitStatusOf = (request: GitContext & { readonly gitArguments: readonly string[] }): GitRun =>
  request.spawn({
    file: "git",
    arguments: ["-C", request.repoRoot, ...request.gitArguments],
    maxBuffer: LARGEST_GIT_OUTPUT_BYTES,
    environment: request.environment,
  });

const answerByStatus = <Value>(request: {
  readonly run: GitRun;
  readonly answers: ReadonlyMap<number, Value>;
}): Answer<Value> => {
  const known = request.run.outcome === "exited" ? request.answers.get(request.run.status) : undefined;
  return known === undefined ? { answered: "no" } : { answered: "yes", value: known };
};

const BASE_PRESENCE_BY_STATUS: ReadonlyMap<number, "present" | "absent"> = new Map([
  [0, "present"],
  [1, "absent"],
]);

const MERGE_BASE_BY_STATUS: ReadonlyMap<number, "found" | "none"> = new Map([
  [0, "found"],
  [1, "none"],
]);

const CLONE_DEPTH_BY_ANSWER: ReadonlyMap<string, CloneDepth> = new Map([
  ["true", "shallow"],
  ["false", "complete"],
]);

const basePresenceOf = (request: BaseQuery): Answer<"present" | "absent"> =>
  answerByStatus({
    run: exitStatusOf({
      ...request,
      gitArguments: ["rev-parse", "--verify", "--quiet", "--end-of-options", `${request.baseRevision}^{commit}`],
    }),
    answers: BASE_PRESENCE_BY_STATUS,
  });

const mergeBaseOf = (request: BaseQuery): Answer<"found" | "none"> =>
  answerByStatus({
    run: exitStatusOf({ ...request, gitArguments: ["merge-base", "--end-of-options", request.baseRevision, "HEAD"] }),
    answers: MERGE_BASE_BY_STATUS,
  });

const cloneDepthOf = (request: GitContext): Answer<CloneDepth> => {
  const output = gitOutput({ ...request, gitArguments: ["rev-parse", "--is-shallow-repository"] });
  const depth = output.outcome === "ok" ? CLONE_DEPTH_BY_ANSWER.get(output.value.stdout.trim()) : undefined;
  return depth === undefined ? { answered: "no" } : { answered: "yes", value: depth };
};

const baseReadFailureOf = (request: BaseQuery & { readonly failure: GitFailure }): BaseReadFailure => {
  const presence = basePresenceOf(request);
  return presence.answered === "yes" && presence.value === "absent" ? { kind: "base-absent" } : request.failure;
};

const unrelatedHistoryFailureOf = (request: BaseQuery & { readonly failure: GitFailure }): ChangeSetFailure => {
  const mergeBase = mergeBaseOf(request);
  if (mergeBase.answered === "no" || mergeBase.value === "found") {
    return request.failure;
  }
  const clone = cloneDepthOf(request);
  return clone.answered === "yes" ? { kind: "no-merge-base", clone: clone.value } : request.failure;
};

const changeSetFailureOf = (request: BaseQuery & { readonly failure: GitFailure }): ChangeSetFailure => {
  const presence = basePresenceOf(request);
  if (presence.answered === "no") {
    return request.failure;
  }
  return presence.value === "absent" ? { kind: "base-absent" } : unrelatedHistoryFailureOf(request);
};

const changedPaths = (request: BaseQuery): Result<readonly RepoPath[], ChangeSetFailure> => {
  const committed = gitPaths({
    ...request,
    gitArguments: ["diff", "--name-only", "-z", "--end-of-options", `${request.baseRevision}...HEAD`],
  });
  if (committed.outcome === "failed") {
    return { outcome: "failed", error: changeSetFailureOf({ ...request, failure: committed.error }) };
  }
  const uncommitted = gitPaths({ ...request, gitArguments: ["diff", "--name-only", "-z", "HEAD"] });
  if (uncommitted.outcome === "failed") {
    return uncommitted;
  }
  const untracked = gitPaths({
    ...request,
    gitArguments: ["ls-files", "--others", "--exclude-standard", "-z"],
  });
  if (untracked.outcome === "failed") {
    return untracked;
  }
  return { outcome: "ok", value: [...new Set([...committed.value, ...uncommitted.value, ...untracked.value])] };
};

const objectNameStatus = (request: { readonly text: string }): "valid" | "invalid" =>
  (request.text.length === 40 || request.text.length === 64) && !/[^0-9a-f]/.test(request.text) ? "valid" : "invalid";

const contentMembership = (
  request: GitContext & GitContentQuery,
): Result<BaseContentMembership, GitFailure> => {
  const candidate = gitOutput({
    ...request,
    gitArguments: ["hash-object", "--", request.file],
  });
  if (candidate.outcome === "failed") {
    return candidate;
  }
  const candidateHash = candidate.value.stdout.replace(/\r?\n$/, "");
  if (objectNameStatus({ text: candidateHash }) === "invalid") {
    return {
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: candidate.value.command,
        detail: "git hash-object did not return one complete lowercase object name",
      },
    };
  }
  const tree = gitOutput({
    ...request,
    gitArguments: ["ls-tree", "-r", "-z", "--format=%(objectname)", "--end-of-options", request.baseRevision],
  });
  if (tree.outcome === "failed") {
    return tree;
  }
  const treeHashes = tree.value.stdout === "" ? [] : tree.value.stdout.split("\0").slice(0, -1);
  if (
    (tree.value.stdout !== "" && !tree.value.stdout.endsWith("\0")) ||
    treeHashes.some((text) => objectNameStatus({ text }) === "invalid")
  ) {
    return {
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: tree.value.command,
        detail: "git ls-tree did not return a complete NUL-separated object-name listing",
      },
    };
  }
  return { outcome: "ok", value: treeHashes.includes(candidateHash) ? "present-in-base" : "absent-from-base" };
};

const fileTextInBase = (request: GitContext & GitContentQuery): Result<BaseFileText, BaseReadFailure> => {
  const listed = gitPaths({
    ...request,
    gitArguments: ["ls-tree", "-z", "--name-only", "--end-of-options", request.baseRevision, request.file],
  });
  if (listed.outcome === "failed") {
    return { outcome: "failed", error: baseReadFailureOf({ ...request, failure: listed.error }) };
  }
  if (!listed.value.includes(request.file)) {
    return { outcome: "ok", value: { presence: "absent-from-base" } };
  }
  const blob = gitOutput({ ...request, gitArguments: ["cat-file", "blob", "--end-of-options", `${request.baseRevision}:${request.file}`] });
  if (blob.outcome === "failed") {
    return { outcome: "failed", error: baseReadFailureOf({ ...request, failure: blob.error }) };
  }
  return { outcome: "ok", value: { presence: "present-in-base", text: blob.value.stdout } };
};

export const createGitPort = (options: {
  readonly spawn: GitSpawn;
  readonly ambientEnvironment: GitEnvironment;
}): GitPort => {
  const environment = environmentWithoutRepositoryLocation({
    ambientEnvironment: options.ambientEnvironment,
  });
  return {
    trackedPaths: (request) =>
      gitPaths({ spawn: options.spawn, environment, repoRoot: request.repoRoot, gitArguments: ["ls-files", "-z"] }),
    changedSince: (request) =>
      changedPaths({
        spawn: options.spawn,
        environment,
        repoRoot: request.repoRoot,
        baseRevision: request.baseRevision,
      }),
    contentInBase: (request) => contentMembership({ ...request, spawn: options.spawn, environment }),
    textInBase: (request) => fileTextInBase({ ...request, spawn: options.spawn, environment }),
  };
};

const TRAILING_LINE_BREAKS = /\n+$/;

const gitListing = (
  request: GitContext & { readonly gitArguments: readonly string[]; readonly separator: string },
): Result<readonly string[], GitFailure> => {
  const output = gitOutput(request);
  if (output.outcome === "failed") {
    return output;
  }
  return {
    outcome: "ok",
    value: output.value.stdout
      .split(request.separator)
      .map((entry) => entry.replace(TRAILING_LINE_BREAKS, ""))
      .filter((entry) => entry.length > 0),
  };
};

const PARENT_SEPARATOR = " ";

const LINE_BREAK = "\n";

const commitRecordOf = (request: { readonly entry: string }): CommitRecord => {
  const [parents, ...messageLines] = request.entry.split(LINE_BREAK);
  return {
    parentCount: parents.split(PARENT_SEPARATOR).filter((parent) => parent.length > 0).length,
    message: messageLines.join(LINE_BREAK),
  };
};

const commitsAfterRevision = (
  request: GitContext & { readonly revision: string },
): Result<readonly CommitRecord[], GitFailure> => {
  const entries = gitListing({
    ...request,
    gitArguments: ["log", "--reverse", "-z", "--format=%P%n%B", "--end-of-options", `${request.revision}..HEAD`],
    separator: "\0",
  });
  return entries.outcome === "failed" ? entries : { outcome: "ok", value: entries.value.map((entry) => commitRecordOf({ entry })) };
};

export const createGitHistoryPort = (options: {
  readonly spawn: GitSpawn;
  readonly ambientEnvironment: GitEnvironment;
}): GitHistoryPort => {
  const environment = environmentWithoutRepositoryLocation({
    ambientEnvironment: options.ambientEnvironment,
  });
  return {
    mergedTags: (request) =>
      gitListing({
        spawn: options.spawn,
        environment,
        repoRoot: request.repoRoot,
        gitArguments: ["tag", "--list", "--merged", "HEAD", request.pattern],
        separator: "\n",
      }),
    commitsAfter: (request) =>
      commitsAfterRevision({ spawn: options.spawn, environment, repoRoot: request.repoRoot, revision: request.revision }),
  };
};

const defaultGitSpawn = (_options: Record<string, never>): GitSpawn => {
  const execution = createDefaultExecutionPort({ policy: GIT_EXECUTION_POLICY });
  return (request) => {
    const executed = execution.run({ arguments: request.arguments });
    if (executed.outcome === "failed") {
      return {
        outcome: "errored",
        detail: executed.error.kind === "terminated"
          ? `git was ended by signal ${executed.error.signal}`
          : executed.error.detail,
      };
    }
    return { outcome: "exited", ...executed.value };
  };
};

export const createDefaultGitPort = (_options: Record<string, never>): GitPort =>
  createGitPort({ spawn: defaultGitSpawn({}), ambientEnvironment: {} });

export const createDefaultGitHistoryPort = (_options: Record<string, never>): GitHistoryPort =>
  createGitHistoryPort({ spawn: defaultGitSpawn({}), ambientEnvironment: {} });
