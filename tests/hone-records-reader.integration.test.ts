import { assert, describe, expect, it } from "vitest";
import { createDefaultDirectoryPort } from "../core/platform-ports/file-system-port.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultGitPort, createDefaultGitTreePort } from "../core/platform-ports/git-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { readHoneRecords } from "../core/records/read-hone-records.ts";
import { createRecordsFolder } from "../core/records/records-folder.ts";
import { recordsReadingOf } from "../core/records/records-reading.ts";
import { createSymptomCatalogueRepository } from "../core/symptom-catalogue/read-symptom-catalogue.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import { repositoryRootOf } from "./allowed-forms-proof.ts";

const REPO_ROOT = absolutePathSchema.parse(repositoryRootOf({ testFolder: import.meta.dirname }));

const FIXTURE = absolutePathSchema.parse(`${import.meta.dirname}/test-fixtures/hone-records-reader`);

const fileText = createDefaultFileTextPort({});

const path = createDefaultPathPort({});

const holding = createSymptomCatalogueRepository({ fileText, path, ruleSetRoot: REPO_ROOT }).read({});
assert(holding.outcome === "ok", "the shipped symptom catalogue reads");
assert(holding.value.held === "catalogue", "the shipped symptom catalogue is present");

const { catalogue } = holding.value;

const AUTHORISED_LOCATION = {
  file: "src/held.ts",
  case: "gives-a-value-its-type",
  owes: "declared-not-asserted",
  whyChain: {
    whys: [
      { why: "Why does held.ts hold this symptom?", because: "An outside contract fixes the shape the unit must meet at this place.", evidence: "src/held.ts:1." },
      { why: "Why does an outside contract fix the shape?", because: "The vendor publishes the payload format and validates requests against it.", evidence: "https://example.com/spec." },
      { why: "Why does the vendor validate requests against the payload format?", because: "Its gateway rejects any field outside the published schema before routing.", evidence: "https://example.com/gateway." },
      { why: "Why does the gateway reject fields outside the published schema?", because: "Strict schemas let the vendor version its interface without silent drift.", evidence: "https://example.com/versioning." },
      { why: "Why do strict schemas let the vendor version without drift?", because: "Clients that send unknown fields fail fast, so every client upgrades on purpose.", evidence: "https://example.com/upgrades." },
    ],
    rootCause: "Clients that send unknown fields fail fast, so every client upgrades on purpose.",
    rootCheck: "On 2026-11-20, https://example.com/upgrades still says unknown fields fail fast.",
    readback: "Clients that send unknown fields fail fast, therefore the vendor keeps strict schemas, therefore held.ts holds this symptom.",
    owner: "owner decision on example/app#1",
  },
};

describe("Hone's records reader over a real hone-records folder, read from disk (CD-47: the fixture folder is the subject; nothing is written)", () => {
  it("reads the plan's record examples, each of its kind, and refuses none", () => {
    const source = createRecordsFolder({
      fileText,
      path,
      directory: createDefaultDirectoryPort({}),
      git: createDefaultGitPort({}),
      gitTree: createDefaultGitTreePort({}),
      repoRoot: FIXTURE,
    });
    expect(readHoneRecords({ source, catalogue, baseRevision: undefined })).toMatchObject({
      outcome: "ok",
      value: {
        records: [
          { place: { file: "hone-records/authorised-locations/claimed-type.json", index: 0 }, record: { kind: "authorised-location", symptom: { name: "claimed-type" }, file: "src/adapters/stripe-webhook.ts" } },
          { place: { file: "hone-records/boundaries.json", index: 0 }, record: { kind: "boundary-record", module: "src/adapters/system-clock.ts", outsideParty: { kind: "runtime", facility: "clock" } } },
          { place: { file: "hone-records/boundaries.json", index: 1 }, record: { kind: "boundary-record", module: "src/adapters/files", outsideParty: { kind: "scheme-module", specifier: "node:fs" } } },
          { place: { file: "hone-records/debt/text-past-its-reader.json", index: 0 }, record: { kind: "debt", symptom: { name: "text-past-its-reader" }, file: "src/orders/charge-order.test.ts" } },
          { place: { file: "hone-records/dependencies.json", index: 0 }, record: { kind: "dependency-record", dependency: "zod" } },
          { place: { file: "hone-records/deviations/stub-with-vifn.json", index: 0 }, record: { kind: "deviation", recipe: { name: "stub-with-vifn" }, file: "src/sync/replay.test.ts" } },
        ],
        refused: [],
      },
    });
  });
});

describe("Helen's rulings, over every symptom in the shipped catalogue", () => {
  it.each(catalogue.symptoms)("accepts debt on $name: debt is debt, not blockers", (symptom) => {
    const file = repoPathSchema.parse(`hone-records/debt/${symptom.name}.json`);
    expect(
      recordsReadingOf({
        documents: [{ file, document: { version: 2, records: [{ symptom: symptom.name, file: "src/held.ts" }] } }],
        catalogue,
        base: { measured: "no", base: { state: "not-given" } },
      }),
    ).toMatchObject({ outcome: "ok", value: { records: [{ record: { kind: "debt", symptom: { name: symptom.name } } }], refused: [] } });
  });

  it.each(catalogue.symptoms)("never refuses an authorised location for being on $name", (symptom) => {
    const file = repoPathSchema.parse(`hone-records/authorised-locations/${symptom.name}.json`);
    expect(
      recordsReadingOf({
        documents: [{ file, document: { version: 2, records: [{ symptom: symptom.name, ...AUTHORISED_LOCATION }] } }],
        catalogue,
        base: { measured: "no", base: { state: "not-given" } },
      }),
    ).toMatchObject({ outcome: "ok", value: { records: [{ record: { kind: "authorised-location", symptom: { name: symptom.name } } }], refused: [] } });
  });
});
