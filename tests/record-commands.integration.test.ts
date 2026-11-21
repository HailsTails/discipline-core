import { afterAll, assert, describe, expect, it } from "vitest";
import type { Finding } from "../core/governance/governance.ts";
import { createDefaultDirectoryPort, createDefaultFileRemovalPort } from "../core/platform-ports/file-system-port.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultGitPort, createDefaultGitTreePort } from "../core/platform-ports/git-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { answerFindings, type RaisedFinding } from "../core/records/answering.ts";
import { authoriseOf, pruneDebtOf, recordDebtOf } from "../core/records/record-commands.ts";
import { readHoneRecords } from "../core/records/read-hone-records.ts";
import { createRecordsFolder } from "../core/records/records-folder.ts";
import { createRecordsStore } from "../core/records/records-store.ts";
import { createSymptomCatalogueRepository } from "../core/symptom-catalogue/read-symptom-catalogue.ts";
import type { TouchedSet } from "../core/touched-set/touched-set.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { mechanismIdSchema } from "../core/values/identifiers.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort } from "../scripts/install-proof-ports.ts";
import { repositoryRootOf } from "./allowed-forms-proof.ts";
import { CAUSAL_WHY_CHAIN } from "./causal-why-chain.ts";
import { recordsRepositoryIn } from "./hone-records-scratch.ts";

const SHIPPED_ROOT = absolutePathSchema.parse(repositoryRootOf({ testFolder: import.meta.dirname }));

const fileText = createDefaultFileTextPort({});

const path = createDefaultPathPort({});

const scratch = createDefaultScratchFilesPort({});

const holding = createSymptomCatalogueRepository({ fileText, path, ruleSetRoot: SHIPPED_ROOT }).read({});
assert(holding.outcome === "ok", "the shipped symptom catalogue reads");
assert(holding.value.held === "catalogue", "the shipped symptom catalogue is present");

const { catalogue } = holding.value;

const made = recordsRepositoryIn({
  ports: { scratch, files: fileText, commands: createDefaultCommandRunPort({}), path },
  repository: {
    base: [{ folder: "hone-records", name: "dependencies.json", records: [{ dependency: "zod", nativeWay: "hand-written parsing at each adapter", whyNotEnough: "Each adapter would repeat its own checks." }] }],
    working: [],
  },
});
assert(made.outcome === "ok", "the scratch repository is made and its base committed");

afterAll(() => {
  scratch.removeTree({ path: made.value });
});

const REPO_ROOT = absolutePathSchema.parse(made.value);

const source = createRecordsFolder({
  fileText,
  path,
  directory: createDefaultDirectoryPort({}),
  git: createDefaultGitPort({}),
  gitTree: createDefaultGitTreePort({}),
  repoRoot: REPO_ROOT,
});

const store = createRecordsStore({ fileText, removal: createDefaultFileRemovalPort({}), directory: createDefaultDirectoryPort({}), path, repoRoot: REPO_ROOT });

const ORDER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/claimed-type.json");

const AUTHORISED_FILE = repoPathSchema.parse("hone-records/authorised-locations/claimed-type.json");

const CAST_IN_ORDERS: Finding = {
  clause: clauseAddressSchema.parse("CD-2#cast-expressions"),
  file: ORDER_FILE,
  anchor: { line: 3, column: 9 },
  snippet: "body as Event",
  mechanism: mechanismIdSchema.parse("eslint"),
};

const RAISED: readonly RaisedFinding[] = [{ finding: CAST_IN_ORDERS, party: { reported: "not-reported" } }];

const NOTHING_CHANGED: TouchedSet = { measured: "yes", paths: new Set() };

const recordDebt = recordDebtOf({ catalogue, source, store });

const pruneDebt = pruneDebtOf({ source, store });

const authorise = authoriseOf({ catalogue, source, store });

const DEBT_TEXT = '{\n  "version": 2,\n  "records": [\n    {\n      "symptom": "claimed-type",\n      "file": "src/orders/charge-order.ts"\n    }\n  ]\n}\n';

const textOf = (request: { readonly file: string }): string => {
  const read = fileText.read({ path: `${made.value}/${request.file}` });
  assert(read.outcome === "ok", "the file is read");
  return read.value;
};

const answering = (request: { readonly findings: readonly RaisedFinding[] }) => {
  const reading = readHoneRecords({ source, catalogue, baseRevision: undefined });
  assert(reading.outcome === "ok", "the records written read back");
  return answerFindings({
    catalogue,
    records: reading.value.records,
    findings: request.findings,
    touched: NOTHING_CHANGED,
    runs: [], measurements: { runs: [], tracked: [], excluded: [] },
  });
};

describe("the version 2 record commands over a real hone-records folder, built in the test's own scratch", () => {
  it("record-debt writes debt the records reader reads and that answers the finding; run again it writes nothing; prune-debt removes it once the finding is fixed", () => {
    expect(recordDebt({ findings: [CAST_IN_ORDERS], touched: NOTHING_CHANGED, leave: [] })).toMatchObject({ outcome: "ok", value: [{ effect: "recorded" }] });
    expect(textOf({ file: DEBT_FILE })).toBe(DEBT_TEXT);
    expect(answering({ findings: RAISED })).toMatchObject({ findings: [], answered: [{ finding: CAST_IN_ORDERS, by: [{ place: { file: DEBT_FILE, index: 0 } }] }], stale: [] });

    expect(recordDebt({ findings: [CAST_IN_ORDERS], touched: NOTHING_CHANGED, leave: [] })).toMatchObject({ outcome: "ok", value: [{ effect: "already-recorded" }] });
    expect(textOf({ file: DEBT_FILE })).toBe(DEBT_TEXT);

    const fixed = answering({ findings: [] });
    expect(fixed.stale).toHaveLength(1);
    expect(pruneDebt({ report: fixed })).toMatchObject({ outcome: "ok", value: [{ reason: "stale" }] });
    expect(fileText.exists({ path: `${made.value}/${DEBT_FILE}` })).toBe("absent");
  });

  it("authorise writes the record the reader reads; the debt it now answers in place of is paid, and prune-debt removes exactly that", () => {
    recordDebt({ findings: [CAST_IN_ORDERS], touched: NOTHING_CHANGED, leave: [] });
    const authorised = authorise({
      symptom: "claimed-type",
      file: ORDER_FILE,
      case: "gives-a-value-its-type",
      owes: "declared-not-asserted",
      whys: CAUSAL_WHY_CHAIN.whys,
      rootCause: CAUSAL_WHY_CHAIN.rootCause,
      rootCheck: CAUSAL_WHY_CHAIN.rootCheck,
      readback: CAUSAL_WHY_CHAIN.readback,
      owner: CAUSAL_WHY_CHAIN.owner,
    });
    expect(authorised).toMatchObject({ outcome: "ok", value: { judged: "accepted" } });

    const answered = answering({ findings: RAISED });
    expect(answered).toMatchObject({ findings: [], answered: [{ by: [{ place: { file: AUTHORISED_FILE, index: 0 } }] }], paid: [{ debt: { place: { file: DEBT_FILE, index: 0 } } }], stale: [] });

    expect(pruneDebt({ report: answered })).toMatchObject({ outcome: "ok", value: [{ reason: "paid" }] });
    expect(fileText.exists({ path: `${made.value}/${DEBT_FILE}` })).toBe("absent");
    expect(answering({ findings: RAISED })).toMatchObject({ findings: [], answered: [{ by: [{ place: { file: AUTHORISED_FILE, index: 0 } }] }], paid: [], stale: [] });
  });
});
