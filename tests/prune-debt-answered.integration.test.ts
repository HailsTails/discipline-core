import { assert, describe, expect, it, vi } from "vitest";
import { runPruneDebtCommand } from "../core/check/run-prune-debt-command.ts";
import { exceptionRepositoryOf } from "../core/exception-records/exception-layout.ts";
import type { FileRemovalPort } from "../core/platform-ports/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../core/platform-ports/file-system-port.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort, GitTreePort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../core/values/repo-path.ts";
import { createWalkerRunner } from "../mechanisms/audit/runner/create-walker-runner.ts";
import { ABSENT_ENTRY_KIND } from "./empty-walker-disk.ts";
import { modulesServingRunner } from "./eslint-toolchains.ts";
import { inMemoryOverlay } from "./overlaid-file-text.ts";
import { defaultParsePort } from "./typescript-parse-port.ts";

const path = createDefaultPathPort({});

const disk = createDefaultFileTextPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const FIXTURE = resolvedPath({ path: `${import.meta.dirname}/test-fixtures/prune-debt-answered` });

const RECORDS_PATH = `${FIXTURE}/discipline-exceptions.json`;

const recordsOnDisk = disk.read({ path: RECORDS_PATH });
assert(recordsOnDisk.outcome === "ok", "the fixture's records read from disk");

const TOOL_COMMAND_URL = new URL("../core/check/tool-command.ts", import.meta.url).href;

const ANSWERED = repoPathSchema.parse("src/answered.ts");
const DOUBLY = repoPathSchema.parse("src/doubly.ts");
const REFUSED = repoPathSchema.parse("src/refused.ts");

const CLASS_SOURCE = "export class Basket {}\n";

const TRACKED = [repoPathSchema.parse("discipline-exceptions.json"), repoPathSchema.parse("disciplines.json"), ANSWERED, DOUBLY, REFUSED];

const fixtureRepository = (): FileTextPort =>
  inMemoryOverlay({
    base: { ...disk, write: vi.fn<FileTextPort["write"]>() },
    files: {
      [RECORDS_PATH]: recordsOnDisk.value,
      [`${FIXTURE}/src/answered.ts`]: CLASS_SOURCE,
      [`${FIXTURE}/src/doubly.ts`]: CLASS_SOURCE,
      [`${FIXTURE}/src/refused.ts`]: CLASS_SOURCE,
    },
  });

const auditRunnerOver = (fileText: FileTextPort): ModuleLoaderPort =>
  modulesServingRunner({
    runnerSuffix: "/mechanisms/audit/runner/runner.ts",
    runner: createWalkerRunner({ fileText, modules: createDefaultModuleLoaderPort({}), path, parse: defaultParsePort, entryKind: ABSENT_ENTRY_KIND }),
    base: createDefaultModuleLoaderPort({}),
  });

const gitChanging = (changed: readonly RepoPath[]): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: TRACKED }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: changed }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
});

const pruneDebtOver = async (request: {
  readonly fileText: FileTextPort;
  readonly git: GitPort;
}) => {
  const writeOut = vi.fn<ProcessPort["writeOut"]>();
  const exitWith = vi.fn<ProcessPort["exitWith"]>();
  const process: ProcessPort = {
    arguments: ["--repo", FIXTURE, "--base-revision", "origin/main"],
    writeOut,
    writeError: vi.fn<ProcessPort["writeError"]>(),
    exitWith,
  };
  const repositoryOf = exceptionRepositoryOf({
    fileText: request.fileText,
    path,
    directory: createDefaultDirectoryPort({}),
    fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
    git: request.git,
    gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>().mockReturnValue({ outcome: "ok", value: [] }) },
  });
  await runPruneDebtCommand({
    process,
    path,
    fileText: request.fileText,
    modules: auditRunnerOver(request.fileText),
    git: request.git,
    exceptionRepositoryOf: repositoryOf,
    moduleUrl: TOOL_COMMAND_URL,
  });
  return { printed: writeOut.mock.calls, exits: exitWith.mock.calls };
};

describe("hone prune-debt over debt whose every finding an authorised location answers, through the walker over written-out sources (CD-47: the fixture repository's records are the subject; nothing is spawned or written to disk)", () => {
  it("removes the forfeited carve-out whose class an authorised location answers, and keeps the doubly held one and the one beside a refused authorised location", async () => {
    expect(await pruneDebtOver({ fileText: fixtureRepository(), git: gitChanging([ANSWERED, REFUSED]) })).toEqual({
      printed: [[{ text: "CD-14#class-syntax removed src/answered.ts\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("removes nothing when no file changed, since a carve-out in force beside an authorised location is doubly held, not paid", async () => {
    expect(await pruneDebtOver({ fileText: fixtureRepository(), git: gitChanging([]) })).toEqual({ printed: [[{ text: "" }]], exits: [[{ code: 0 }]] });
  });

  it("removes the answered carve-out from the records on a first run, and nothing on a second run over the records the first left", async () => {
    const fileText = fixtureRepository();
    const git = gitChanging([ANSWERED, REFUSED]);
    const first = await pruneDebtOver({ fileText, git });
    const second = await pruneDebtOver({ fileText, git });
    expect({ first, second }).toEqual({
      first: { printed: [[{ text: "CD-14#class-syntax removed src/answered.ts\n" }]], exits: [[{ code: 0 }]] },
      second: { printed: [[{ text: "" }]], exits: [[{ code: 0 }]] },
    });
  });
});
