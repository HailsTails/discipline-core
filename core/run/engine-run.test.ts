import { describe, expect, it, vi } from "vitest";
import type { ChecksRunReport, ChecksRunner } from "../mechanism-port/checks-runner-types.ts";
import type { NativeException } from "../mechanism-port/runner-result-schema.ts";
import type { LoadedRunner } from "../mechanism-port/runner-module-schema.ts";
import type { ClauseBinding } from "../settings/selection.ts";
import type { ModuleLoad, ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import type { Check } from "../symptom-catalogue/symptom-catalogue.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { FIRST_EDITION } from "../values/edition.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { type EngineRunRequest, engineRunOf, loadedEngineOf } from "./engine-run.ts";

const ESLINT = mechanismIdSchema.parse("eslint");

const AUDIT = mechanismIdSchema.parse("audit");

const REPO = absolutePathSchema.parse("/repo");

const INSTALL = absolutePathSchema.parse("/install");

const CLASS_CLAUSE = clauseAddressSchema.parse("CD-14#class-syntax");

const A = repoPathSchema.parse("src/a.ts");

const CLASS_KEYWORD: Check = {
  name: "class-keyword",
  symptom: {
    name: "authored-class-or-this",
    title: "Authored class or this",
    seen: "a class is written",
    mayIndicate: [],
    breachUsuallySits: "in the design",
    recipes: [],
    correctUses: [],
  },
  clause: CLASS_CLAUSE,
  engines: [{ name: "eslint", mechanism: ESLINT }],
  forms: [],
};

const BINDING: ClauseBinding = {
  mechanism: ESLINT,
  clause: { address: CLASS_CLAUSE, anchor: { kind: "keyword", keyword: "class" }, pieceRoot: "/install/mechanisms/eslint/CD-14", clauseSettings: {}, edition: FIRST_EDITION, settings: {} },
};

const REQUEST: EngineRunRequest = {
  repoRoot: REPO,
  installRoot: INSTALL,
  files: [A],
  trackedPaths: [A],
  checks: [CLASS_KEYWORD],
  bindings: [BINDING],
  answered: [],
  declaredConfigRoots: [],
  declaredConfigLookup: undefined,
};

const HIT = { clause: CLASS_CLAUSE, file: A, anchor: { line: 1, column: 7 }, snippet: "export class A {}", check: "authored-class-or-this#class-keyword" };

const REPORT: ChecksRunReport = { hits: [HIT], nativeExceptions: [], measured: [{ clause: CLASS_CLAUSE, file: A }], projection: "missing", misnamedRuleIds: [] };

const PROJECTED_KINDS: NativeException["kind"][] = ["config-override", "inline-disable"];

type ChecksRunResult = Awaited<ReturnType<ChecksRunner["run"]>>;

const checksRunnerReturning = (request: { readonly returned: ChecksRunResult }) => ({
  projectedKinds: PROJECTED_KINDS,
  run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue(request.returned),
  conform: vi.fn<(request: unknown) => Promise<unknown>>(),
});

const STANDALONE: LoadedRunner = {
  exceptionPath: "standalone",
  run: () => Promise.resolve({ outcome: "ok", value: { hits: [{ clause: CLASS_CLAUSE, file: A, anchor: { line: 3, column: 1 }, snippet: "class A {}" }], nativeExceptions: [] } }),
  conform: () => Promise.resolve({ outcome: "ok", value: [] }),
};

const EMBEDDED: LoadedRunner = {
  exceptionPath: "embedded",
  projectedKinds: ["config-override"],
  run: () => Promise.resolve({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current", slices: [] } }),
  conform: () => Promise.resolve({ outcome: "ok", value: [] }),
  project: () => Promise.resolve({ outcome: "ok", value: [] }),
};

const embeddedWith = (request: { readonly returned: ChecksRunResult }) => ({
  engine: { mechanism: ESLINT, runner: EMBEDDED, checksRunner: checksRunnerReturning(request) },
  request: REQUEST,
});

describe("engineRunOf, a checks runner", () => {
  it("gives the report's hits, native exceptions, measured pairs, projection and misnamed rule ids, coverable by the kinds the runner projects", async () => {
    expect(await engineRunOf(embeddedWith({ returned: { outcome: "ok", value: REPORT } }))).toEqual({
      outcome: "ok",
      value: {
        mechanism: ESLINT,
        hits: [HIT],
        nativeExceptions: [],
        coverableKinds: ["config-override", "inline-disable"],
        projection: "missing",
        slices: [],
        unprojectedFolders: [],
        measured: [{ clause: CLASS_CLAUSE, file: A }],
        misnamedRuleIds: [],
      },
    });
  });

  it("asks the runner with the files, checks, bindings and answered files it was given", async () => {
    const asked = embeddedWith({ returned: { outcome: "ok", value: REPORT } });
    await engineRunOf(asked);
    expect(vi.mocked(asked.engine.checksRunner.run).mock.calls).toEqual([[REQUEST]]);
  });

  it("fails as an invalid output when a hit is in a file the request did not hold", async () => {
    const other = repoPathSchema.parse("src/other.ts");
    expect(await engineRunOf(embeddedWith({ returned: { outcome: "ok", value: { ...REPORT, hits: [{ ...HIT, file: other }] } } }))).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: ESLINT,
        failure: { kind: "runner-invalid-output", detail: "a hit names CD-14#class-syntax in src/other.ts, which the request did not hold" },
      },
    });
  });

  it("fails as an invalid output when the runner names a check its clause does not have", async () => {
    const hitOfAnotherCheck = { ...HIT, check: "authored-class-or-this#class-heritage" };
    expect(await engineRunOf(embeddedWith({ returned: { outcome: "ok", value: { ...REPORT, hits: [hitOfAnotherCheck] } } }))).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: ESLINT,
        failure: {
          kind: "runner-invalid-output",
          detail: "the report names the check authored-class-or-this#class-heritage of CD-14#class-syntax, which that clause does not have",
        },
      },
    });
  });

  it("fails with the failure the runner gave", async () => {
    expect(await engineRunOf(embeddedWith({ returned: { outcome: "failed", error: { kind: "tool-failed", detail: "ESLint stopped" } } }))).toEqual({
      outcome: "failed",
      error: { kind: "runner-failed", mechanism: ESLINT, failure: { kind: "tool-failed", detail: "ESLint stopped" } },
    });
  });

  it("fails as not ready yet when the runner says its config roots are not ready", async () => {
    expect(await engineRunOf(embeddedWith({ returned: { outcome: "failed", error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots" } } } }))).toEqual({
      outcome: "failed",
      error: { kind: "not-ready-yet", what: { thing: "eslint-config-roots" } },
    });
  });

  it("fails as an invalid runner when an embedded runner module exports no checks runner", async () => {
    expect(await engineRunOf({ engine: { mechanism: ESLINT, runner: EMBEDDED, checksRunner: undefined }, request: REQUEST })).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-invalid",
        mechanism: ESLINT,
        detail: "the runner module exports no checksRunner, which a version 2 run needs of an engine that runs through a native tool",
      },
    });
  });

  it("fails as a failed runner when the runner throws", async () => {
    const throwing = { projectedKinds: [], run: () => Promise.reject(new Error("boom")), conform: () => Promise.resolve(undefined) };
    expect(await engineRunOf({ engine: { mechanism: ESLINT, runner: EMBEDDED, checksRunner: throwing }, request: REQUEST })).toMatchObject({
      outcome: "failed",
      error: { kind: "runner-failed", mechanism: ESLINT, failure: { kind: "runner-invalid-output", detail: "the runner call threw or rejected: boom" } },
    });
  });
});

describe("engineRunOf, a standalone runner", () => {
  it("gives the runner's hits with no projection", async () => {
    const request = { ...REQUEST, bindings: [{ ...BINDING, mechanism: AUDIT }] };
    expect(await engineRunOf({ engine: { mechanism: AUDIT, runner: STANDALONE, checksRunner: undefined }, request })).toEqual({
      outcome: "ok",
      value: {
        mechanism: AUDIT,
        hits: [{ clause: CLASS_CLAUSE, file: A, anchor: { line: 3, column: 1 }, snippet: "class A {}" }],
        nativeExceptions: [],
        coverableKinds: ["inline-disable"],
        projection: "none",
        slices: [],
        unprojectedFolders: [],
        measured: [],
        misnamedRuleIds: [],
      },
    });
  });
});

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });

const loaderGiving = (request: { readonly loaded: ModuleLoad }): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue(request.loaded),
});

const loadedWith = (request: { readonly mechanism: typeof ESLINT; readonly loaded: ModuleLoad }) =>
  loadedEngineOf({ mechanism: request.mechanism, installRoot: INSTALL, moduleExtension: ".ts", path: POSIX_PATH, modules: loaderGiving(request) });

describe("loadedEngineOf", () => {
  it("loads the runner and the checks runner a mechanism's module exports", async () => {
    const checksRunner = { projectedKinds: ["config-override"], run: () => Promise.resolve(undefined), conform: () => Promise.resolve(undefined) };
    expect(await loadedWith({ mechanism: ESLINT, loaded: { outcome: "ok", value: { runner: STANDALONE, checksRunner } } })).toMatchObject({
      outcome: "ok",
      value: { mechanism: ESLINT, runner: { exceptionPath: "standalone" }, checksRunner: { projectedKinds: ["config-override"] } },
    });
  });

  it("loads a mechanism whose module exports no checks runner", async () => {
    expect(await loadedWith({ mechanism: ESLINT, loaded: { outcome: "ok", value: { runner: STANDALONE } } })).toMatchObject({
      outcome: "ok",
      value: { mechanism: ESLINT, checksRunner: undefined },
    });
  });

  it("fails as an invalid runner, in the loader's words, when the module cannot be loaded", async () => {
    const unloadable: ModuleLoad = { outcome: "failed", error: { kind: "module-unloadable", path: "/install/mechanisms/eslint/runner/runner.ts", detail: "Cannot find module" } };
    expect(await loadedWith({ mechanism: ESLINT, loaded: unloadable })).toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: ESLINT, detail: "Cannot find module" },
    });
  });

  it("fails as an invalid runner when the module exports no runner", async () => {
    expect(await loadedWith({ mechanism: ESLINT, loaded: { outcome: "ok", value: {} } })).toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: ESLINT },
    });
  });
});
