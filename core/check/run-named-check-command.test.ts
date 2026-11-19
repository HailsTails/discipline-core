import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import type { RecordKind } from "../symptom-catalogue/symptom-catalogue.ts";
import type { CheckReport } from "../verdict/check-report.ts";
import type { SymptomGuide } from "../verdict/symptom-notes.ts";
import type { CheckRun } from "./command-outcome.ts";
import type { CommandRequest } from "./run-check-command.ts";
import { namedCheckRunFor } from "./run-named-check-command.ts";

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

const RUN: CheckRun = {
  report: EMPTY_REPORT,
  output: "full",
  projectCommand: "node core/check/tool-command.ts project --repo .",
  pruneCommand: "node core/check/tool-command.ts prune-debt --repo .",
};

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const GUIDE: SymptomGuide = {
  guide: "catalogue",
  catalogue: {
    principles: [],
    rules: [],
    recipes: [],
    recordKinds: [AUTHORISED_LOCATION, DEBT],
    alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
    symptoms: [],
    clauses: [],
  },
  page: "node_modules/@hailstails/hone/rules/typescript/symptoms.md" };

const COMMAND: CommandRequest = {
  process: {
    arguments: ["--repo", "/repo"],
    writeOut: vi.fn<ProcessPort["writeOut"]>(),
    writeError: vi.fn<ProcessPort["writeError"]>(),
    exitWith: vi.fn<ProcessPort["exitWith"]>(),
  },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  fileText: { read: vi.fn<FileTextPort["read"]>(), exists: vi.fn<FileTextPort["exists"]>(), write: vi.fn<FileTextPort["write"]>() },
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
    changedSince: vi.fn<GitPort["changedSince"]>(),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
  },
  exceptionRepositoryOf: vi.fn(),
  moduleUrl: "file:///repo/node_modules/@hailstails/hone/core/check/tool-command.ts",
};

describe("namedCheckRunFor", () => {
  it("gives the check run with the symptom guide beside it", async () => {
    expect(
      await namedCheckRunFor({
        ...COMMAND,
        checkRunFor: vi.fn().mockResolvedValue({ outcome: "ok", value: RUN }),
        symptomGuideFor: vi.fn().mockReturnValue({ outcome: "ok", value: GUIDE }),
      }),
    ).toEqual({ outcome: "ok", value: { ...RUN, guide: GUIDE } });
  });

  it("gives the check's load failure", async () => {
    expect(
      await namedCheckRunFor({
        ...COMMAND,
        checkRunFor: vi.fn().mockResolvedValue({ outcome: "failed", error: { kind: "selection-absent", repo: "/repo" } }),
        symptomGuideFor: vi.fn().mockReturnValue({ outcome: "ok", value: GUIDE }),
      }),
    ).toEqual({ outcome: "failed", error: { kind: "selection-absent", repo: "/repo" } });
  });

  it("gives the guide's load failure when the check ran", async () => {
    expect(
      await namedCheckRunFor({
        ...COMMAND,
        checkRunFor: vi.fn().mockResolvedValue({ outcome: "ok", value: RUN }),
        symptomGuideFor: vi.fn().mockReturnValue({
          outcome: "failed",
          error: { kind: "file-malformed", path: "node_modules/@hailstails/hone/rules/typescript/symptoms.json", detail: "Unexpected end" },
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: "node_modules/@hailstails/hone/rules/typescript/symptoms.json", detail: "Unexpected end" },
    });
  });

  it("hands the command to both", async () => {
    const checkRunFor = vi.fn().mockResolvedValue({ outcome: "ok", value: RUN });
    const symptomGuideFor = vi.fn().mockReturnValue({ outcome: "ok", value: GUIDE });

    await namedCheckRunFor({ ...COMMAND, checkRunFor, symptomGuideFor });

    expect({ checkRunFor: checkRunFor.mock.calls, symptomGuideFor: symptomGuideFor.mock.calls }).toEqual({
      checkRunFor: [[expect.objectContaining(COMMAND)]],
      symptomGuideFor: [[expect.objectContaining(COMMAND)]],
    });
  });
});
