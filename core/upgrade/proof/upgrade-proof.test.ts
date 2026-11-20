import { describe, expect, it, type Mock, vi } from "vitest";
import { callSequenceOf } from "../../../tests/call-sequence.ts";
import { LOOP_KEYWORD_LOOPS, LOOPS_CLAUSE, SETTINGS_CATALOGUE } from "../../../tests/settings-catalogue.ts";
import type { ConsumerSelectionFile } from "../../consumer-selection/selection-file.ts";
import type { Finding } from "../../governance/governance.ts";
import type { DirectoryRemovalPort } from "../../platform-ports/directory-removal-port.ts";
import type { FileCreationPort } from "../../platform-ports/file-creation-port.ts";
import type { FileRemovalPort } from "../../platform-ports/file-removal-port.ts";
import type { DirectoryPort, EntryKindPort, FileTextPort } from "../../platform-ports/file-system-port.ts";
import { createPathPort } from "../../platform-ports/path-port.ts";
import type { RunReport } from "../../report/run-report.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { TOOL_RULE_SET } from "../../values/clause-address.ts";
import { mechanismIdSchema } from "../../values/identifiers.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import type { CheckReport } from "../../verdict/check-report.ts";
import type { CarveOutOracle, FileCarveOutRecord } from "../carve-out-oracle/carve-out-oracle.ts";
import type { HeadRecord } from "../version-one-head/head-records.ts";
import { type ProofRuns, upgradeProof, type UpgradeProofRequest } from "./upgrade-proof.ts";
import type { ProjectionTextOf, VersionOneReading } from "./upgrade-plan.ts";

const CATALOGUES: readonly RuleSetCatalogue[] = [{ ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE }];

const AUDIT = mechanismIdSchema.parse("audit");

const SRC_A = repoPathSchema.parse("src/a.ts");

const REPO = absolutePathSchema.parse("/repo");

const SELECTION: ConsumerSelectionFile = {
  version: 1,
  ruleSets: [],
  clauses: [[LOOPS_CLAUSE, { state: "run", mechanism: AUDIT }]],
  exclude: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "required",
  reportOutput: "full",
  assessment: { forfeiture: "this-run" },
  clauseSettings: [],
  checkEditions: "pinned",
};

const CARVE_OUT: FileCarveOutRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" };

const CARVE_OUT_HEAD: HeadRecord = {
  kind: "file-carve-out",
  record: CARVE_OUT,
  entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/a.ts", reason: "legacy loop" },
};

const ORIGINAL_CONFIG = 'import disciplines from "./disciplines.eslint.mjs";\nexport default [...disciplines];\n';

const READING: VersionOneReading = {
  selection: SELECTION,
  heads: [CARVE_OUT_HEAD],
  teamConfig: { file: repoPathSchema.parse("eslint.config.mjs"), text: ORIGINAL_CONFIG },
  versionOneProjection: repoPathSchema.parse("disciplines.eslint.mjs"),
};

const EMPTY_BEFORE: CheckReport = {
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

const EMPTY_AFTER: RunReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
  findings: [],
  answered: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  misnamed: [],
  paid: [],
  refused: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  notes: [],
  recordNotes: [],
  carried: [],
  symptoms: [],
};

const LOOP_FINDING: Finding = {
  clause: LOOPS_CLAUSE,
  file: SRC_A,
  anchor: { line: 3, column: 1 },
  snippet: "the loop line",
  mechanism: AUDIT,
  check: "loop-keyword#loops",
};

const ok = { outcome: "ok", value: undefined } as const;

type MockedPorts = {
  readonly fileText: { readonly read: Mock<FileTextPort["read"]>; readonly exists: Mock<FileTextPort["exists"]>; readonly write: Mock<FileTextPort["write"]> };
  readonly fileCreation: { readonly createNew: Mock<FileCreationPort["createNew"]> };
  readonly fileRemoval: { readonly remove: Mock<FileRemovalPort["remove"]> };
  readonly directory: { readonly list: Mock<DirectoryPort["list"]>; readonly create: Mock<DirectoryPort["create"]> };
  readonly directoryRemoval: { readonly removeEmpty: Mock<DirectoryRemovalPort["removeEmpty"]> };
  readonly entryKind: { readonly kindOf: Mock<EntryKindPort["kindOf"]> };
  readonly path: UpgradeProofRequest["ports"]["path"];
};

const kindsOfEveryPlannedFileNew = () =>
  vi
    .fn<EntryKindPort["kindOf"]>()
    .mockReturnValueOnce("absent")
    .mockReturnValueOnce("absent")
    .mockReturnValueOnce("absent")
    .mockReturnValueOnce("directory")
    .mockReturnValueOnce("absent")
    .mockReturnValueOnce("absent")
    .mockReturnValueOnce("directory")
    .mockReturnValueOnce("directory");

const kindsOfExistingFirstFile = () => vi.fn<EntryKindPort["kindOf"]>().mockReturnValueOnce("file");

const portsOver = (request: { readonly kindOf: Mock<EntryKindPort["kindOf"]> }): MockedPorts => ({
  fileText: {
    read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: ORIGINAL_CONFIG }),
    exists: vi.fn<FileTextPort["exists"]>(),
    write: vi.fn<FileTextPort["write"]>().mockReturnValue(ok),
  },
  fileCreation: { createNew: vi.fn<FileCreationPort["createNew"]>().mockReturnValue(ok) },
  fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>().mockReturnValue(ok) },
  directory: { list: vi.fn<DirectoryPort["list"]>().mockReturnValue({ outcome: "ok", value: [] }), create: vi.fn<DirectoryPort["create"]>().mockReturnValue(ok) },
  directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>().mockReturnValue(ok) },
  entryKind: { kindOf: request.kindOf },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
});

type Doubles = {
  readonly ports: MockedPorts;
  readonly oracle: { readonly answer: Mock<CarveOutOracle["answer"]> };
  readonly runs: { readonly versionOne: Mock<ProofRuns["versionOne"]>; readonly versionTwo: Mock<ProofRuns["versionTwo"]> };
};

const doublesOver = (request: { readonly kindOf: Mock<EntryKindPort["kindOf"]> }): Doubles => ({
  ports: portsOver(request),
  oracle: { answer: vi.fn<CarveOutOracle["answer"]>().mockResolvedValue({ outcome: "ok", value: [{ record: CARVE_OUT, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } }] }) },
  runs: {
    versionOne: vi.fn<ProofRuns["versionOne"]>().mockResolvedValue({ outcome: "ok", value: EMPTY_BEFORE }),
    versionTwo: vi.fn<ProofRuns["versionTwo"]>().mockResolvedValue({ outcome: "ok", value: EMPTY_AFTER }),
  },
});

const requestOver = (request: { readonly doubles: Doubles }): UpgradeProofRequest => ({
  ports: request.doubles.ports,
  oracle: request.doubles.oracle,
  runs: request.doubles.runs,
  reading: READING,
  versionOneFiles: {
    recordsFiles: [repoPathSchema.parse("discipline-exceptions/cd-15.json")],
    recordsRoot: { kind: "folder", folder: repoPathSchema.parse("discipline-exceptions") },
    settings: repoPathSchema.parse("disciplines.json"),
  },
  catalogues: CATALOGUES,
  repoRoot: REPO,
  versionTwoProjection: repoPathSchema.parse("hone.eslint.mjs"),
  projectionTextOf: vi.fn<ProjectionTextOf>().mockReturnValue("projection text"),
});

const sequenceOf = (request: { readonly doubles: Doubles }) =>
  callSequenceOf({
    mocks: {
      answer: request.doubles.oracle.answer,
      versionOne: request.doubles.runs.versionOne,
      versionTwo: request.doubles.runs.versionTwo,
      kindOf: request.doubles.ports.entryKind.kindOf,
      read: request.doubles.ports.fileText.read,
      create: request.doubles.ports.directory.create,
      createNew: request.doubles.ports.fileCreation.createNew,
      write: request.doubles.ports.fileText.write,
      remove: request.doubles.ports.fileRemoval.remove,
      list: request.doubles.ports.directory.list,
      removeEmpty: request.doubles.ports.directoryRemoval.removeEmpty,
    },
  });

const SINGLE_FILE_LAYOUT: UpgradeProofRequest["versionOneFiles"] = {
  recordsFiles: [repoPathSchema.parse("discipline-exceptions.json")],
  recordsRoot: { kind: "repository" },
  settings: repoPathSchema.parse("disciplines.json"),
};

const SETTINGS_PATH = "/repo/hone.config.json";

const DEBT_PATH = "/repo/hone-records/debt/loop-keyword.json";

const PROJECTION_PATH = "/repo/hone.eslint.mjs";

const CONFIG_PATH = "/repo/eslint.config.mjs";

const ASKING_THE_ORACLE = [{ port: "answer", arguments: [{ records: [CARVE_OUT] }] }];

const RUNNING_VERSION_ONE = [{ port: "versionOne", arguments: [] }];

const PLANNING_THE_WRITES = [
  { port: "kindOf", arguments: [{ path: SETTINGS_PATH }] },
  { port: "kindOf", arguments: [{ path: DEBT_PATH }] },
  { port: "kindOf", arguments: [{ path: PROJECTION_PATH }] },
  { port: "read", arguments: [{ path: CONFIG_PATH }] },
  { port: "kindOf", arguments: [{ path: "/repo" }] },
  { port: "kindOf", arguments: [{ path: "/repo/hone-records/debt" }] },
  { port: "kindOf", arguments: [{ path: "/repo/hone-records" }] },
  { port: "kindOf", arguments: [{ path: "/repo" }] },
  { port: "kindOf", arguments: [{ path: "/repo" }] },
];

const WRITING = [
  { port: "create", arguments: [{ path: "/repo/hone-records" }] },
  { port: "create", arguments: [{ path: "/repo/hone-records/debt" }] },
  { port: "createNew", arguments: [{ path: SETTINGS_PATH, text: expect.any(String) }] },
  { port: "createNew", arguments: [{ path: DEBT_PATH, text: expect.any(String) }] },
  { port: "createNew", arguments: [{ path: PROJECTION_PATH, text: "projection text" }] },
  { port: "write", arguments: [{ path: CONFIG_PATH, text: 'import disciplines from "./hone.eslint.mjs";\nexport default [...disciplines];\n' }] },
];

const RUNNING_VERSION_TWO = [{ port: "versionTwo", arguments: [] }];

const ROLLING_BACK = [
  { port: "write", arguments: [{ path: CONFIG_PATH, text: ORIGINAL_CONFIG }] },
  { port: "remove", arguments: [{ path: PROJECTION_PATH }] },
  { port: "remove", arguments: [{ path: DEBT_PATH }] },
  { port: "remove", arguments: [{ path: SETTINGS_PATH }] },
  { port: "removeEmpty", arguments: [{ path: "/repo/hone-records/debt" }] },
  { port: "removeEmpty", arguments: [{ path: "/repo/hone-records" }] },
];

const REMOVING_VERSION_ONE = [
  { port: "remove", arguments: [{ path: "/repo/discipline-exceptions/cd-15.json" }] },
  { port: "list", arguments: [{ path: "/repo/discipline-exceptions" }] },
  { port: "removeEmpty", arguments: [{ path: "/repo/discipline-exceptions" }] },
  { port: "remove", arguments: [{ path: "/repo/disciplines.eslint.mjs" }] },
  { port: "remove", arguments: [{ path: "/repo/disciplines.json" }] },
];

describe("upgradeProof", () => {
  it("writes the version 2 files, finds the two runs equal and removes the version 1 files, in that order", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "ok",
      value: {
        written: ["hone.config.json", "hone-records/debt/loop-keyword.json", "hone.eslint.mjs"],
        replaced: "eslint.config.mjs",
        removed: {
          files: ["/repo/discipline-exceptions/cd-15.json", "/repo/disciplines.eslint.mjs", "/repo/disciplines.json"],
          folders: ["/repo/discipline-exceptions"],
        },
      },
    });
    expect(sequenceOf({ doubles })).toEqual([
      ...ASKING_THE_ORACLE,
      ...RUNNING_VERSION_ONE,
      ...PLANNING_THE_WRITES,
      ...WRITING,
      ...RUNNING_VERSION_TWO,
      ...REMOVING_VERSION_ONE,
    ]);
  });

  it("refuses, before running or writing anything, when the oracle cannot answer", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.oracle.answer.mockResolvedValue({ outcome: "failed", error: { kind: "version-one-run-failed", detail: "the eslint runner threw" } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "oracle-failed", failure: { kind: "version-one-run-failed", detail: "the eslint runner threw" } },
    });
    expect(sequenceOf({ doubles })).toEqual(ASKING_THE_ORACLE);
  });

  it("refuses, before running or writing anything, a carve-out that answered nothing", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.oracle.answer.mockResolvedValue({ outcome: "ok", value: [{ record: CARVE_OUT, answer: { credit: "nothing" } }] });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "plan-refused",
        refusal: { kind: "mapping-refused", refusals: [{ kind: "record-answers-nothing", clause: "CD-15#loops", file: "src/a.ts", credited: "nothing" }] },
      },
    });
    expect(sequenceOf({ doubles })).toEqual(ASKING_THE_ORACLE);
  });

  it("refuses, before writing anything, when the version 1 run fails", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.runs.versionOne.mockResolvedValue({ outcome: "failed", error: { kind: "run-failed", detail: "no selection" } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-one-run-failed", failure: { kind: "run-failed", detail: "no selection" } },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE]);
  });

  it("refuses, before the second run, when a file it would write already exists", async () => {
    const doubles = doublesOver({ kindOf: kindsOfExistingFirstFile() });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "write-refused", refusal: { failure: { kind: "path-already-exists", path: SETTINGS_PATH }, unrestored: [] } },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE, { port: "kindOf", arguments: [{ path: SETTINGS_PATH }] }]);
  });

  it("restores what it wrote when the version 2 run fails, and removes nothing", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.runs.versionTwo.mockResolvedValue({ outcome: "failed", error: { kind: "run-failed", detail: "config unreadable" } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-two-run-failed", failure: { kind: "run-failed", detail: "config unreadable" }, unrestored: [] },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE, ...PLANNING_THE_WRITES, ...WRITING, ...RUNNING_VERSION_TWO, ...ROLLING_BACK]);
  });

  it("restores what it wrote and names the difference when the two runs do not agree, removing nothing", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.runs.versionTwo.mockResolvedValue({ outcome: "ok", value: { ...EMPTY_AFTER, findings: [LOOP_FINDING] } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "differences",
        differences: [
          { section: "findings", onlyBefore: [], onlyAfter: ["CD-15#loops src/a.ts 3:1"] },
          { section: "verdict", onlyBefore: ["pass"], onlyAfter: ["fail"] },
        ],
        unrestored: [],
      },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE, ...PLANNING_THE_WRITES, ...WRITING, ...RUNNING_VERSION_TWO, ...ROLLING_BACK]);
  });

  it("leaves the version 2 files in place and reports what was removed when a version 1 file cannot be removed", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.ports.fileRemoval.remove.mockReturnValue({ outcome: "failed", error: { kind: "unremovable", path: "/repo/discipline-exceptions/cd-15.json", detail: "EBUSY" } });
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "removal-failed",
        failure: { kind: "unremovable", path: "/repo/discipline-exceptions/cd-15.json", detail: "EBUSY", removed: { files: [], folders: [] } },
        written: ["hone.config.json", "hone-records/debt/loop-keyword.json", "hone.eslint.mjs"],
        replaced: "eslint.config.mjs",
      },
    });
    expect(sequenceOf({ doubles })).toEqual([
      ...ASKING_THE_ORACLE,
      ...RUNNING_VERSION_ONE,
      ...PLANNING_THE_WRITES,
      ...WRITING,
      ...RUNNING_VERSION_TWO,
      { port: "remove", arguments: [{ path: "/repo/discipline-exceptions/cd-15.json" }] },
    ]);
  });

  it("upgrades a repository whose version 1 records sit in the single file at its root, removing no folder", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    await expect(upgradeProof({ ...requestOver({ doubles }), versionOneFiles: SINGLE_FILE_LAYOUT })).resolves.toEqual({
      outcome: "ok",
      value: {
        written: ["hone.config.json", "hone-records/debt/loop-keyword.json", "hone.eslint.mjs"],
        replaced: "eslint.config.mjs",
        removed: { files: ["/repo/discipline-exceptions.json", "/repo/disciplines.eslint.mjs", "/repo/disciplines.json"], folders: [] },
      },
    });
    expect(sequenceOf({ doubles })).toEqual([
      ...ASKING_THE_ORACLE,
      ...RUNNING_VERSION_ONE,
      ...PLANNING_THE_WRITES,
      ...WRITING,
      ...RUNNING_VERSION_TWO,
      { port: "remove", arguments: [{ path: "/repo/discipline-exceptions.json" }] },
      { port: "remove", arguments: [{ path: "/repo/disciplines.eslint.mjs" }] },
      { port: "remove", arguments: [{ path: "/repo/disciplines.json" }] },
    ]);
  });

  it("refuses, before writing anything, a version 1 records file outside its records folder", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    const request = requestOver({ doubles });
    await expect(upgradeProof({ ...request, versionOneFiles: { ...request.versionOneFiles, recordsFiles: [repoPathSchema.parse("tools/x.json")] } })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "removal-refused", failure: { kind: "records-file-outside-root", path: "/repo/tools/x.json", root: "/repo/discipline-exceptions" } },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE]);
  });

  it("restores what it wrote when the version 2 run rejects", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.runs.versionTwo.mockRejectedValue(new Error("the runner threw"));
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-two-run-failed", failure: { kind: "run-failed", detail: "the runner threw" }, unrestored: [] },
    });
    expect(sequenceOf({ doubles })).toEqual([...ASKING_THE_ORACLE, ...RUNNING_VERSION_ONE, ...PLANNING_THE_WRITES, ...WRITING, ...RUNNING_VERSION_TWO, ...ROLLING_BACK]);
  });

  it("names what it could not restore when the version 2 run rejects and a file cannot be removed", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.runs.versionTwo.mockRejectedValue(new Error("the runner threw"));
    doubles.ports.fileRemoval.remove.mockReturnValueOnce(ok).mockReturnValueOnce({ outcome: "failed", error: { kind: "unremovable", path: DEBT_PATH, detail: "EBUSY" } }).mockReturnValue(ok);
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-two-run-failed", failure: { kind: "run-failed", detail: "the runner threw" }, unrestored: [{ path: DEBT_PATH, detail: "EBUSY" }] },
    });
  });

  it("reports what it wrote, and leaves it, when removing a version 1 file throws", async () => {
    const doubles = doublesOver({ kindOf: kindsOfEveryPlannedFileNew() });
    doubles.ports.fileRemoval.remove.mockThrow(new Error("the removal threw"));
    await expect(upgradeProof(requestOver({ doubles }))).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "removal-threw",
        detail: "the removal threw",
        written: ["hone.config.json", "hone-records/debt/loop-keyword.json", "hone.eslint.mjs"],
        replaced: "eslint.config.mjs",
      },
    });
  });
});
