import { assert, describe, expect, it, vi } from "vitest";
import { runPruneDebtCommand } from "../core/check/run-prune-debt-command.ts";
import { createDefaultExceptionRepositoryOf } from "../core/exception-records/exception-layout.ts";
import type { ExceptionRepository } from "../core/exception-records/exception-records.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { type RepoPath, repoPathSchema } from "../core/values/repo-path.ts";
import { createWalkerRunner } from "../mechanisms/audit/runner/create-walker-runner.ts";
import { ABSENT_ENTRY_KIND } from "./empty-walker-disk.ts";
import { modulesServingRunner } from "./eslint-toolchains.ts";
import { overlaidFileText } from "./overlaid-file-text.ts";
import { defaultParsePort } from "./typescript-parse-port.ts";

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const FIXTURE = resolvedPath({ path: `${import.meta.dirname}/test-fixtures/prune-debt-answered` });

const TOOL_COMMAND_URL = new URL("../core/check/tool-command.ts", import.meta.url).href;

const LOOPS = clauseAddressSchema.parse("CD-15#loops");

const ANSWERED = repoPathSchema.parse("src/answered.ts");
const DOUBLY = repoPathSchema.parse("src/doubly.ts");
const REFUSED = repoPathSchema.parse("src/refused.ts");

const LOOP_SOURCE = "export const totalOf = (prices: readonly number[]): number => {\n  let total = 0;\n  for (const price of prices) {\n    total += price;\n  }\n  return total;\n};\n";

const TRACKED = [repoPathSchema.parse("discipline-exceptions.json"), repoPathSchema.parse("disciplines.json"), ANSWERED, DOUBLY, REFUSED];

const fixtureFiles: FileTextPort = overlaidFileText({
  base: createDefaultFileTextPort({}),
  files: {
    [`${FIXTURE}/src/answered.ts`]: LOOP_SOURCE,
    [`${FIXTURE}/src/doubly.ts`]: LOOP_SOURCE,
    [`${FIXTURE}/src/refused.ts`]: LOOP_SOURCE,
  },
});

const auditRunnerOverFixture: ModuleLoaderPort = modulesServingRunner({
  runnerSuffix: "/mechanisms/audit/runner/runner.ts",
  runner: createWalkerRunner({
    fileText: fixtureFiles,
    modules: createDefaultModuleLoaderPort({}),
    path,
    parse: defaultParsePort,
    entryKind: ABSENT_ENTRY_KIND,
  }),
  base: createDefaultModuleLoaderPort({}),
});

const processGiven = (argumentsGiven: readonly string[]): ProcessPort => ({
  arguments: argumentsGiven,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const gitChanging = (changed: readonly RepoPath[]): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: TRACKED }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: changed }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
});

const pruneDebtOverFixture = (request: { readonly git: GitPort; readonly remove: ExceptionRepository["remove"] }) =>
  runPruneDebtCommand({
    process: processGiven(["--repo", FIXTURE, "--base-revision", "origin/main"]),
    path,
    fileText: fixtureFiles,
    modules: auditRunnerOverFixture,
    git: request.git,
    exceptionRepositoryOf: (repository) => ({ ...createDefaultExceptionRepositoryOf({})(repository), remove: request.remove }),
    moduleUrl: TOOL_COMMAND_URL,
  });

describe("hone prune-debt over debt whose every finding an authorised location answers, through the walker over written-out sources (CD-47: the fixture repository's records are the subject; nothing is spawned or written)", () => {
  it("removes the forfeited carve-out whose loop an authorised location answers, and keeps the doubly held one and the one beside a refused authorised location", async () => {
    const remove = vi.fn<ExceptionRepository["remove"]>().mockReturnValue({ outcome: "ok", value: [{ clause: LOOPS, file: ANSWERED }] });
    await pruneDebtOverFixture({ git: gitChanging([ANSWERED, REFUSED]), remove });
    expect(remove).toHaveBeenCalledExactlyOnceWith({ pairs: [{ clause: LOOPS, file: ANSWERED }] });
  });

  it("removes nothing when no file changed, since a carve-out in force beside an authorised location is doubly held, not paid", async () => {
    const remove = vi.fn<ExceptionRepository["remove"]>().mockReturnValue({ outcome: "ok", value: [] });
    await pruneDebtOverFixture({ git: gitChanging([]), remove });
    expect(remove).toHaveBeenCalledExactlyOnceWith({ pairs: [] });
  });
});
