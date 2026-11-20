import { describe, expect, it, vi } from "vitest";
import { ESLINT, REPORT_CATALOGUE } from "../../tests/report-catalogue.ts";
import type { CommandRequest } from "../check/run-check-command.ts";
import type { ExceptionRepositoryOf } from "../exception-records/exception-records.ts";
import type { DirectoryPort, FileRemovalPort } from "../platform-ports/file-system-port.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort, GitTreePort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import type { RecordsReading } from "../records/hone-record.ts";
import type { RunLoadFailure } from "../report/run-load-failure.ts";
import { DEFAULT_CONVENTIONS } from "../settings/conventions.ts";
import type { SettingsReading } from "../settings/read-settings.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { EngineRun } from "./engine-run.ts";
import type { StagesOver } from "./version-two-check-command.ts";
import { versionTwoAuthoriseCommandOf, versionTwoPruneDebtCommandOf, versionTwoRecordDebtCommandOf } from "./version-two-record-commands.ts";
import type { VersionTwoStages } from "./version-two-run.ts";

const FILE_A = repoPathSchema.parse("src/a.ts");

const SETTINGS: SettingsReading = {
  selection: {
    selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
    bindings: [],
    clauseRoots: [],
    excluded: [],
    eslintConfigRoots: [],
    fileExceptionWhyChains: "required",
  },
  runSettings: { reportOutput: "failures-only", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: { lookup: "detected" },
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
};

const RECORDS: RecordsReading = { records: [], refused: [], notes: [], base: { measured: "yes" } };

const CLEAN_RUN: EngineRun = {
  mechanism: ESLINT,
  hits: [],
  nativeExceptions: [],
  coverableKinds: [],
  projection: "current",
  slices: [],
  unprojectedFolders: [],
  measured: [],
  misnamedRuleIds: [],
};

const stagesGiving = (request: Partial<VersionTwoStages>): VersionTwoStages => ({
  catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({ outcome: "ok", value: REPORT_CATALOGUE }),
  settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "ok", value: SETTINGS }),
  records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "ok", value: RECORDS }),
  tree: vi.fn<VersionTwoStages["tree"]>().mockReturnValue({ outcome: "ok", value: { tracked: [FILE_A], declaredConfigRoots: [] } }),
  engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [CLEAN_RUN] }),
  touched: vi.fn<VersionTwoStages["touched"]>().mockReturnValue({ measured: "yes", paths: new Set() }),
  ...request,
});

const ENTRY_URL = "file:///install/core/check/tool-command.ts";

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandWith = (request: { readonly process: ProcessPort }): CommandRequest => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: {
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
    read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/package.json", detail: "absent" } }),
    write: vi.fn<FileTextPort["write"]>(),
  },
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
    changedSince: vi.fn<GitPort["changedSince"]>(),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
  },
  exceptionRepositoryOf: vi.fn<ExceptionRepositoryOf>(),
  moduleUrl: ENTRY_URL,
});

const ports = (request: { readonly stagesOver: StagesOver }) => ({
  gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>().mockReturnValue({ outcome: "ok", value: [] }) },
  directory: { list: vi.fn<DirectoryPort["list"]>().mockReturnValue({ outcome: "ok", value: [] }), create: vi.fn<DirectoryPort["create"]>() },
  removal: { remove: vi.fn<FileRemovalPort["remove"]>() },
  stagesOver: request.stagesOver,
});

const stagesOverGiving = (request: { readonly stages: VersionTwoStages }) => vi.fn<StagesOver>().mockReturnValue(request.stages);

type Handler = typeof versionTwoRecordDebtCommandOf;

const ranWith = async (request: { readonly handler: Handler; readonly arguments: readonly string[]; readonly stagesOver: StagesOver }) => {
  const processPort = processWith({ arguments: request.arguments });
  await request.handler(ports({ stagesOver: request.stagesOver }))(commandWith({ process: processPort }));
  return { writes: vi.mocked(processPort.writeOut).mock.calls, exits: vi.mocked(processPort.exitWith).mock.calls };
};

const CONFIG_ABSENT: RunLoadFailure = { kind: "config-absent", repo: "/repo" };

const CONFIG_ABSENT_LINE = "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root\n";

const ARGUMENTS_INVALID_LINE = "load failure: arguments-invalid --repo needs a value, as in --repo <dir>\n";

const AUTHORISE_ARGUMENTS = [
  "--repo",
  "/repo",
  "--symptom",
  "claimed-type",
  "--file",
  "src/a.ts",
  "--case",
  "a-case",
  "--owes",
  "a-principle",
  "--why",
  "why one?",
  "--because",
  "because one",
  "--evidence",
  "evidence one",
  "--root-cause",
  "a cause",
  "--root-check",
  "a check",
  "--readback",
  "a readback",
  "--owner",
  "an owner",
] as const;

describe("versionTwoRecordDebtCommandOf", () => {
  it("builds the stages over the repository and the base revision given, and prints nothing when no debt is needed", async () => {
    const stagesOver = stagesOverGiving({ stages: stagesGiving({}) });
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: ["--repo", "/repo", "--base-revision", "origin/main"],
      stagesOver,
    });
    expect(ran).toEqual({ writes: [[{ text: "" }]], exits: [[{ code: 0 }]] });
    expect(stagesOver).toHaveBeenCalledWith(
      expect.objectContaining({ locations: { repoRoot: "/repo", installRoot: "/install", moduleExtension: ".ts", baseRevision: "origin/main" } }),
    );
  });

  it("decides forfeiture through the stages' touched set, as the check does", async () => {
    const stages = stagesGiving({});
    await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: ["--repo", "/repo", "--base-revision", "origin/main"], stagesOver: stagesOverGiving({ stages }) });
    expect(stages.touched).toHaveBeenCalled();
  });

  it("prints the load failure line and exits 2 when a stage fails", async () => {
    const stages = stagesGiving({ settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "failed", error: CONFIG_ABSENT }) });
    const ran = await ranWith({
      handler: versionTwoRecordDebtCommandOf,
      arguments: ["--repo", "/repo", "--base-revision", "origin/main"],
      stagesOver: stagesOverGiving({ stages }),
    });
    expect(ran).toEqual({ writes: [[{ text: CONFIG_ABSENT_LINE }]], exits: [[{ code: 2 }]] });
  });

  it("prints an arguments-invalid line and builds no stages when the arguments are not readable", async () => {
    const stagesOver = stagesOverGiving({ stages: stagesGiving({}) });
    const ran = await ranWith({ handler: versionTwoRecordDebtCommandOf, arguments: ["--repo"], stagesOver });
    expect(ran).toEqual({ writes: [[{ text: ARGUMENTS_INVALID_LINE }]], exits: [[{ code: 2 }]] });
    expect(stagesOver).not.toHaveBeenCalled();
  });
});

describe("versionTwoPruneDebtCommandOf", () => {
  it("prints nothing and exits 0 when the run shows no debt paid, stale or forfeited", async () => {
    const ran = await ranWith({ handler: versionTwoPruneDebtCommandOf, arguments: ["--repo", "/repo"], stagesOver: stagesOverGiving({ stages: stagesGiving({}) }) });
    expect(ran).toEqual({ writes: [[{ text: "" }]], exits: [[{ code: 0 }]] });
  });

  it("prints the load failure line and exits 2 when a stage fails", async () => {
    const stages = stagesGiving({ records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "failed", error: CONFIG_ABSENT }) });
    const ran = await ranWith({ handler: versionTwoPruneDebtCommandOf, arguments: ["--repo", "/repo"], stagesOver: stagesOverGiving({ stages }) });
    expect(ran).toEqual({ writes: [[{ text: CONFIG_ABSENT_LINE }]], exits: [[{ code: 2 }]] });
  });

  it("prints an arguments-invalid line and builds no stages when the arguments are not readable", async () => {
    const stagesOver = stagesOverGiving({ stages: stagesGiving({}) });
    const ran = await ranWith({ handler: versionTwoPruneDebtCommandOf, arguments: ["--repo"], stagesOver });
    expect(ran).toEqual({ writes: [[{ text: ARGUMENTS_INVALID_LINE }]], exits: [[{ code: 2 }]] });
    expect(stagesOver).not.toHaveBeenCalled();
  });
});

describe("versionTwoAuthoriseCommandOf", () => {
  it("reads only the catalogue, never running the engines, to write the location", async () => {
    const stages = stagesGiving({});
    await ranWith({ handler: versionTwoAuthoriseCommandOf, arguments: AUTHORISE_ARGUMENTS, stagesOver: stagesOverGiving({ stages }) });
    expect(stages.catalogue).toHaveBeenCalled();
    expect(stages.engines).not.toHaveBeenCalled();
  });

  it("prints the load failure line and exits 2 when the catalogue cannot be read", async () => {
    const stages = stagesGiving({ catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({ outcome: "failed", error: CONFIG_ABSENT }) });
    const ran = await ranWith({ handler: versionTwoAuthoriseCommandOf, arguments: AUTHORISE_ARGUMENTS, stagesOver: stagesOverGiving({ stages }) });
    expect(ran).toEqual({ writes: [[{ text: CONFIG_ABSENT_LINE }]], exits: [[{ code: 2 }]] });
  });

  it("prints an arguments-invalid line and builds no stages when an option is missing a value", async () => {
    const stagesOver = stagesOverGiving({ stages: stagesGiving({}) });
    const ran = await ranWith({ handler: versionTwoAuthoriseCommandOf, arguments: ["--repo"], stagesOver });
    expect(ran).toEqual({ writes: [[{ text: ARGUMENTS_INVALID_LINE }]], exits: [[{ code: 2 }]] });
    expect(stagesOver).not.toHaveBeenCalled();
  });
});
