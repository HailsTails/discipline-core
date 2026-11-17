import { describe, expect, it, vi } from "vitest";
import type { CommandRequest } from "../core/check/run-check-command.ts";
import type { Finding } from "../core/governance/governance.ts";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { mechanismIdSchema } from "../core/values/identifiers.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import type { CheckReport } from "../core/verdict/check-report.ts";
import { runSelfCheck, selfCheckOutcomeOf } from "./self-check-gate.ts";

const EMPTY_REPORT: CheckReport = {
  excluded: [],
  findings: [],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
};

const CLASS_IN_A: Finding = {
  clause: clauseAddressSchema.parse("CD-14#class-syntax"),
  file: repoPathSchema.parse("src/a.ts"),
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
  mechanism: mechanismIdSchema.parse("audit"),
};

describe("selfCheckOutcomeOf", () => {
  it("passes a clean run, printing the report and the gate line", () => {
    expect(selfCheckOutcomeOf({ result: { outcome: "ok", value: { report: EMPTY_REPORT, output: "full" } } })).toEqual({
      code: 0,
      text: "verdict: pass\nself-check: pass, the selection, records and projection are sound; findings (0) and unrecorded (0) are reported above and not gated\n",
    });
  });

  it("passes a run whose only failures are findings, printing them in full as not gated", () => {
    expect(
      selfCheckOutcomeOf({ result: { outcome: "ok", value: { report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] }, output: "full" } } }),
    ).toEqual({
      code: 0,
      text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nverdict: fail\nself-check: pass, the selection, records and projection are sound; findings (1) and unrecorded (0) are reported above and not gated\n",
    });
  });

  it("fails naming each gated section that holds an entry", () => {
    expect(
      selfCheckOutcomeOf({
        result: {
          outcome: "ok",
          value: {
            report: {
              ...EMPTY_REPORT,
              findings: [CLASS_IN_A],
              uncovered: [clauseAddressSchema.parse("CD-15#loops")],
              unmeasured: [{ kind: "import-unmeasured" }],
            },
            output: "counts",
          },
        },
      }),
    ).toEqual({
      code: 1,
      text: "findings (1)\nuncovered (1)\nunmeasured (1)\nverdict: fail\nself-check: fail, gated sections hold entries: uncovered (1), unmeasured (1)\n",
    });
  });

  it("exits 2 with the load failure when the check cannot load", () => {
    expect(selfCheckOutcomeOf({ result: { outcome: "failed", error: { kind: "arguments-invalid", detail: "--repo is required" } } })).toEqual({
      code: 2,
      text: "load failure: arguments-invalid --repo is required\n",
    });
  });
});

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const requestOver = (request: { readonly process: ProcessPort }): CommandRequest => ({
  process: request.process,
  path: {
    join: vi.fn<PathPort["join"]>(),
    relative: vi.fn<PathPort["relative"]>(),
    joinRepository: vi.fn<PathPort["joinRepository"]>(),
    directoryOf: vi.fn<PathPort["directoryOf"]>(),
    repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
    resolve: vi.fn<PathPort["resolve"]>(),
    fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
  },
  fileText: { read: vi.fn<FileTextPort["read"]>(), exists: vi.fn<FileTextPort["exists"]>(), write: vi.fn<FileTextPort["write"]>() },
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
    changedSince: vi.fn<GitPort["changedSince"]>(),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
  },
  moduleUrl: "file:///install/core/check/tool-command.ts",
});

describe("runSelfCheck", () => {
  it("takes the hone subcommands, so a missing one exits 2 with the usage line and reads nothing", async () => {
    const processPort = processWith({ arguments: ["--repo", "."] });
    const request = requestOver({ process: processPort });

    await runSelfCheck(request);

    expect({
      writes: vi.mocked(processPort.writeOut).mock.calls,
      exits: vi.mocked(processPort.exitWith).mock.calls,
      reads: vi.mocked(request.fileText.read).mock.calls,
    }).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid unknown subcommand "--repo"; usage: hone check /) }]],
      exits: [[{ code: 2 }]],
      reads: [],
    });
  });
});