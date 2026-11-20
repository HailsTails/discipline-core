import { describe, expect, it } from "vitest";
import type { RecordKind, Symptom, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { RecordsAtBase } from "./hone-record.ts";
import { carriedListingOf, recordsReadingOf } from "./records-reading.ts";

const AUTHORISED_LOCATION_KIND: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

const DEBT_KIND: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const CLAIMED_TYPE: Symptom = { name: "claimed-type", title: "Claimed type", seen: "A cast.", mayIndicate: [], breachUsuallySits: "in the unit", recipes: [], correctUses: [] };

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
  engines: [],
  symptoms: [CLAIMED_TYPE],
  clauses: [],
  checks: [],
  namedBans: [],
};

const UNMEASURED: RecordsAtBase = { measured: "no", base: { state: "not-given" } };

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/claimed-type.json");

const BOUNDARIES_FILE = repoPathSchema.parse("hone-records/boundaries.json");

const ADAPTER = repoPathSchema.parse("src/adapters/ids.ts");

describe("recordsReadingOf", () => {
  it("places each record by its file and its index there, in the order the documents come", () => {
    expect(
      recordsReadingOf({
        documents: [
          { file: BOUNDARIES_FILE, document: { version: 2, records: [{ module: "src/adapters/system-clock.ts", outsideParty: "runtime:clock", ports: ["Clock"] }] } },
          { file: DEBT_FILE, document: { version: 2, records: [{ symptom: "claimed-type", file: "src/a.ts" }, { symptom: "claimed-type", file: "src/b.ts" }] } },
        ],
        catalogue: CATALOGUE,
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file: BOUNDARIES_FILE, index: 0 },
            record: { kind: "boundary-record", module: "src/adapters/system-clock.ts", outsideParty: { kind: "runtime", facility: "clock" }, holding: { held: "stated", ports: ["Clock"] } },
          },
          { place: { file: DEBT_FILE, index: 0 }, record: { kind: "debt", symptom: CLAIMED_TYPE, file: "src/a.ts", holding: { held: "stated" } } },
          { place: { file: DEBT_FILE, index: 1 }, record: { kind: "debt", symptom: CLAIMED_TYPE, file: "src/b.ts", holding: { held: "stated" } } },
        ],
        refused: [],
      },
    });
  });

  it("places a refused record by its file and index, beside the records it does not stop", () => {
    expect(
      recordsReadingOf({
        documents: [{ file: DEBT_FILE, document: { version: 2, records: [{ symptom: "claimed-type" }, { symptom: "claimed-type", file: "src/b.ts" }] } }],
        catalogue: CATALOGUE,
        base: UNMEASURED,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        records: [{ place: { file: DEBT_FILE, index: 1 }, record: { kind: "debt", symptom: CLAIMED_TYPE, file: "src/b.ts", holding: { held: "stated" } } }],
        refused: [{ place: { file: DEBT_FILE, index: 0 }, refusals: [{ kind: "form-refused", issues: [expect.objectContaining({ path: ["file"] })] }] }],
      },
    });
  });

  it("refuses a second record of one kind on one symptom and site, naming the first", () => {
    const record = { symptom: "claimed-type", file: "src/a.ts" };
    expect(recordsReadingOf({ documents: [{ file: DEBT_FILE, document: { version: 2, records: [record, record] } }], catalogue: CATALOGUE, base: UNMEASURED })).toEqual({
      outcome: "ok",
      value: {
        records: [{ place: { file: DEBT_FILE, index: 0 }, record: { kind: "debt", symptom: CLAIMED_TYPE, file: "src/a.ts", holding: { held: "stated" } } }],
        refused: [{ place: { file: DEBT_FILE, index: 1 }, refusals: [{ kind: "duplicate", of: { file: DEBT_FILE, index: 0 } }] }],
      },
    });
  });

  it("refuses a second boundary record for one module and outside party", () => {
    const record = { module: "src/adapters/files", outsideParty: "node:fs", ports: ["FileReader"] };
    expect(
      recordsReadingOf({ documents: [{ file: BOUNDARIES_FILE, document: { version: 2, records: [record, { ...record, ports: ["FileWriter"] }] } }], catalogue: CATALOGUE, base: UNMEASURED }),
    ).toMatchObject({ outcome: "ok", value: { refused: [{ place: { file: BOUNDARIES_FILE, index: 1 }, refusals: [{ kind: "duplicate", of: { file: BOUNDARIES_FILE, index: 0 } }] }] } });
  });

  it("refuses a document that is not version 2, with the form's issues as values", () => {
    expect(recordsReadingOf({ documents: [{ file: DEBT_FILE, document: { version: 1, records: [] } }], catalogue: CATALOGUE, base: UNMEASURED })).toEqual({
      outcome: "failed",
      error: [{ kind: "document-refused", file: DEBT_FILE, issues: [expect.objectContaining({ code: "invalid_value", path: ["version"] })] }],
    });
  });

  it("lists each carried record with what it lacks and its standing, and no stated record", () => {
    expect(
      carriedListingOf({
        records: [
          {
            place: { file: BOUNDARIES_FILE, index: 0 },
            record: { kind: "boundary-record", module: ADAPTER, outsideParty: { kind: "runtime", facility: "clock" }, holding: { held: "stated", ports: ["Clock"] } },
          },
          {
            place: { file: BOUNDARIES_FILE, index: 1 },
            record: {
              kind: "boundary-record",
              module: ADAPTER,
              outsideParty: { kind: "specifier", specifier: "uuid" },
              holding: { held: "carried", entry: { kind: "authorised-location" }, lacks: ["ports"], standing: "established" },
            },
          },
          { place: { file: DEBT_FILE, index: 0 }, record: { kind: "debt", symptom: CLAIMED_TYPE, file: ADAPTER, holding: { held: "carried", entry: {}, lacks: [], standing: "unjudged" } } },
        ],
      }),
    ).toEqual([
      { place: { file: BOUNDARIES_FILE, index: 1 }, lacks: ["ports"], standing: "established" },
      { place: { file: DEBT_FILE, index: 0 }, lacks: [], standing: "unjudged" },
    ]);
  });

  it("refuses a file that is not a records file", () => {
    const file = repoPathSchema.parse("hone-records/carve-outs/claimed-type.json");
    expect(recordsReadingOf({ documents: [{ file, document: { version: 2, records: [] } }], catalogue: CATALOGUE, base: UNMEASURED })).toEqual({
      outcome: "failed",
      error: [{ kind: "not-a-records-file", file }],
    });
  });
});
