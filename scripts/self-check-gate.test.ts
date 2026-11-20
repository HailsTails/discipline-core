import { describe, expect, it, vi } from "vitest";
import type { ExceptionRepositoryOf } from "../core/exception-records/exception-records.ts";
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
import { NO_SYMPTOM_GUIDE, type SymptomGuide } from "../core/verdict/symptom-notes.ts";
import type { Case, Principle, RecordKind, Rule, Symptom } from "../core/symptom-catalogue/symptom-catalogue.ts";
import { runSelfCheck, selfCheckOutcomeOf } from "./self-check-gate.ts";

const PROJECT_COMMAND = "node core/check/tool-command.ts project --repo .";

const PRUNE_COMMAND = "node core/check/tool-command.ts prune-debt --repo .";

const EMPTY_REPORT: CheckReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
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
  readFirst: [],
};

const CLASS_IN_A: Finding = {
  clause: clauseAddressSchema.parse("CD-14#class-syntax"),
  file: repoPathSchema.parse("src/a.ts"),
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
  mechanism: mechanismIdSchema.parse("audit"),
};

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const DOER_OR_ORCHESTRATOR: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const KEEPS_STATE: Case = {
  name: "keeps-state-or-settings-across-calls",
  title: "Keeps state or settings across calls",
  standing: "accepted",
  owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }],
};

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const CLASS_DECLARED: Symptom = {
  name: "class-declared",
  title: "Class declared",
  seen: "A class declaration.",
  mayIndicate: [{ case: KEEPS_STATE, points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] }],
  breachUsuallySits: "in the unit that holds state",
  recipes: [],
  correctUses: [],
};

const CLASS_GUIDE: SymptomGuide = {
  guide: "catalogue",
  page: "node_modules/@hailstails/hone/rules/typescript/symptoms.md",
  catalogue: {
    principles: [ONE_PLACE_DECIDES],
    rules: [DOER_OR_ORCHESTRATOR],
    cases: [KEEPS_STATE],
    recipes: [],
    recordKinds: [AUTHORISED_LOCATION, DEBT],
    alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
    engines: [],
    symptoms: [CLASS_DECLARED],
    clauses: [{ clause: clauseAddressSchema.parse("CD-14#class-syntax"), sight: { kind: "one-symptom", symptom: CLASS_DECLARED } }],
    checks: [],
    namedBans: [],
  },
};

describe("selfCheckOutcomeOf", () => {
  it("passes a clean run, printing the report and the gate line", () => {
    expect(selfCheckOutcomeOf({ result: { outcome: "ok", value: { report: EMPTY_REPORT, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, eslintProjection: "javascript", guide: NO_SYMPTOM_GUIDE } } })).toEqual({
      code: 0,
      text: "verdict: pass\nself-check: pass, the selection, records and projection are sound; findings (0) and unrecorded (0) are reported above and not gated\n",
    });
  });

  it("passes a run whose only failures are findings, printing them in full as not gated", () => {
    expect(
      selfCheckOutcomeOf({ result: { outcome: "ok", value: { report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] }, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, eslintProjection: "javascript", guide: NO_SYMPTOM_GUIDE } } }),
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
              unmeasured: [{ kind: "import-unmeasured", base: { state: "not-given" } }],
            },
            output: "counts", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, eslintProjection: "javascript", guide: NO_SYMPTOM_GUIDE,
          },
        },
      }),
    ).toEqual({
      code: 1,
      text: "findings (1)\nuncovered (1)\nunmeasured (1)\nverdict: fail\nself-check: fail, gated sections hold entries: uncovered (1), unmeasured (1)\n",
    });
  });

  it("names each finding's symptom from the guide, with the symptom's note in readFirst", () => {
    expect(
      selfCheckOutcomeOf({
        result: {
          outcome: "ok",
          value: { report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] }, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, eslintProjection: "javascript", guide: CLASS_GUIDE },
        },
      }),
    ).toEqual({
      code: 0,
      text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {} symptom: class-declared, may indicate: doer-or-orchestrator\nreadFirst (1)\nclass-declared: Class declared. May indicate: keeps state or settings across calls → Doer or orchestrator. The breach usually sits in the unit that holds state. Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#class-declared\nverdict: fail\nself-check: pass, the selection, records and projection are sound; findings (1) and unrecorded (0) are reported above and not gated\n",
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
  exceptionRepositoryOf: vi.fn<ExceptionRepositoryOf>(),
  moduleUrl: "file:///install/core/check/tool-command.ts",
});

describe("runSelfCheck", () => {
  it("takes the hone subcommands, so a missing one exits 2 with the arguments-invalid line and reads nothing", async () => {
    const processPort = processWith({ arguments: ["--repo", "."] });
    const request = requestOver({ process: processPort });

    await runSelfCheck(request);

    expect({
      writes: vi.mocked(processPort.writeOut).mock.calls,
      exits: vi.mocked(processPort.exitWith).mock.calls,
      reads: vi.mocked(request.fileText.read).mock.calls,
    }).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid hone has no command "--repo"; /) }]],
      exits: [[{ code: 2 }]],
      reads: [],
    });
  });
});