import { describe, expect, it, vi } from "vitest";
import { AUDIT, CAST_EXPRESSIONS, CLAIMED_TYPE, ESLINT, ESLINT_ENGINE, REPORT_CATALOGUE, WHOLE_SYMPTOM } from "../../tests/report-catalogue.ts";
import type { ClauseBinding } from "../consumer-selection/selection.ts";
import type { ChecksRunRequest } from "../mechanism-port/checks-runner-types.ts";
import type { ModuleLoad, ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import type { RecordsReading } from "../records/hone-record.ts";
import type { SettingsReading } from "../settings/read-settings.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { DEFAULT_CONVENTIONS } from "../settings/conventions.ts";
import { FIRST_EDITION } from "../values/edition.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { enginesRunOf } from "./engines-run.ts";

const REPO = absolutePathSchema.parse("/repo");

const INSTALL = absolutePathSchema.parse("/install");

const A = repoPathSchema.parse("src/a.ts");

const README = repoPathSchema.parse("README.md");

const bindingOn = (request: { readonly mechanism: typeof ESLINT }): ClauseBinding => ({
  mechanism: request.mechanism,
  clause: { address: CAST_EXPRESSIONS, anchor: { kind: "file" }, pieceRoot: "/install/pieces", clauseSettings: {}, edition: FIRST_EDITION, settings: {} },
});

const settingsBinding = (request: { readonly bindings: readonly ClauseBinding[] }): SettingsReading => ({
  selection: {
    selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
    bindings: request.bindings,
    clauseRoots: [],
    excluded: [],
    eslintConfigRoots: [],
    fileExceptionWhyChains: "required",
  },
  runSettings: { reportOutput: "full", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: { lookup: "detected" },
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
});

const DEBT_ON_A: RecordsReading = {
  records: [{ place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 0 }, record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: A, holding: { held: "stated" } } }],
  refused: [],
  notes: [],
  base: { measured: "yes" },
};

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });

const STANDALONE_MODULE = {
  runner: {
    exceptionPath: "standalone",
    run: () => Promise.resolve({ outcome: "ok", value: { hits: [], nativeExceptions: [] } }),
    conform: () => Promise.resolve({ outcome: "ok", value: [] }),
  },
};

const REPORT = { hits: [], nativeExceptions: [], measured: [], projection: "current", misnamedRuleIds: [] };

const EMBEDDED_MODULE = {
  runner: {
    exceptionPath: "embedded",
    projectedKinds: ["config-override"],
    run: () => Promise.resolve(undefined),
    conform: () => Promise.resolve(undefined),
    project: () => Promise.resolve(undefined),
  },
  checksRunner: { projectedKinds: ["config-override"], run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: REPORT }) },
};

const NOT_ASKED_FOR: ModuleLoad = { outcome: "failed", error: { kind: "module-unloadable", path: "/nowhere", detail: "not asked for" } };

const modulesOf = (request: { readonly first: ModuleLoad; readonly second: ModuleLoad }): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValueOnce(request.first).mockResolvedValueOnce(request.second),
});

const runOver = (request: { readonly bindings: readonly ClauseBinding[]; readonly first: ModuleLoad; readonly second: ModuleLoad }) =>
  enginesRunOf({
    catalogue: REPORT_CATALOGUE,
    settings: settingsBinding(request),
    records: DEBT_ON_A,
    tree: { tracked: [A, README], declaredConfigRoots: [] },
    repoRoot: REPO,
    installRoot: INSTALL,
    moduleExtension: ".ts",
    path: POSIX_PATH,
    modules: modulesOf(request),
  });

describe("enginesRunOf", () => {
  it("runs each mechanism the selection binds once, loading its runner module from the install", async () => {
    const modules = modulesOf({ first: { outcome: "ok", value: STANDALONE_MODULE }, second: { outcome: "ok", value: EMBEDDED_MODULE } });
    const run = await enginesRunOf({
      catalogue: REPORT_CATALOGUE,
      settings: settingsBinding({ bindings: [bindingOn({ mechanism: AUDIT }), bindingOn({ mechanism: ESLINT }), bindingOn({ mechanism: AUDIT })] }),
      records: DEBT_ON_A,
      tree: { tracked: [A, README], declaredConfigRoots: [] },
      repoRoot: REPO,
      installRoot: INSTALL,
      moduleExtension: ".ts",
      path: POSIX_PATH,
      modules,
    });
    expect(run).toMatchObject({ outcome: "ok", value: [{ mechanism: AUDIT }, { mechanism: ESLINT }] });
    expect(vi.mocked(modules.load).mock.calls).toEqual([[{ path: "/install/mechanisms/audit/runner/runner.ts" }], [{ path: "/install/mechanisms/eslint/runner/runner.ts" }]]);
  });

  it("asks a checks runner with the TypeScript files, the tracked paths, the catalogue's checks, the bindings and the files records answer", async () => {
    const asked = vi.mocked(EMBEDDED_MODULE.checksRunner.run);
    asked.mockClear();
    await runOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: { outcome: "ok", value: EMBEDDED_MODULE }, second: NOT_ASKED_FOR });
    const expected: ChecksRunRequest = {
      repoRoot: REPO,
      installRoot: INSTALL,
      files: [A],
      trackedPaths: [A, README],
      checks: REPORT_CATALOGUE.checks,
      bindings: [bindingOn({ mechanism: ESLINT })],
      answered: [{ symptom: "claimed-type", file: A }],
      declaredConfigRoots: [],
    };
    expect(asked.mock.calls).toEqual([[expected]]);
  });

  it("fails as an invalid engine, naming the engine the catalogue gives the mechanism, when its module cannot be loaded", async () => {
    const unloadable: ModuleLoad = { outcome: "failed", error: { kind: "module-unloadable", path: "/install/mechanisms/eslint/runner/runner.ts", detail: "Cannot find module" } };
    expect(await runOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: unloadable, second: NOT_ASKED_FOR })).toEqual({
      outcome: "failed",
      error: { kind: "engine-invalid", engine: { named: "engine", engine: ESLINT_ENGINE }, detail: "Cannot find module" },
    });
  });

  it("fails as an engine that failed, naming the engine, when its runner fails", async () => {
    const failing = { ...EMBEDDED_MODULE, checksRunner: { projectedKinds: [], run: () => Promise.resolve({ outcome: "failed", error: { kind: "tool-failed", detail: "ESLint stopped" } }) } };
    expect(await runOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: { outcome: "ok", value: failing }, second: NOT_ASKED_FOR })).toEqual({
      outcome: "failed",
      error: { kind: "engine-failed", engine: { named: "engine", engine: ESLINT_ENGINE }, failure: { kind: "tool-failed", detail: "ESLint stopped" } },
    });
  });

  it("fails as not ready yet when the ESLint runner says its config roots are not ready", async () => {
    const notReady = { ...EMBEDDED_MODULE, checksRunner: { projectedKinds: [], run: () => Promise.resolve({ outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots" } } }) } };
    expect(await runOver({ bindings: [bindingOn({ mechanism: ESLINT })], first: { outcome: "ok", value: notReady }, second: NOT_ASKED_FOR })).toEqual({
      outcome: "failed",
      error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots" } },
    });
  });

  it("runs nothing when the selection binds no mechanism", async () => {
    expect(await runOver({ bindings: [], first: NOT_ASKED_FOR, second: NOT_ASKED_FOR })).toEqual({ outcome: "ok", value: [] });
  });
});
