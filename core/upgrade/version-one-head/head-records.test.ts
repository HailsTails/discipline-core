import { describe, expect, it } from "vitest";
import type { Selection } from "../../settings/selection.ts";
import { clauseAddressSchema } from "../../values/clause-address.ts";
import { mechanismIdSchema } from "../../values/identifiers.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import { type PlacedEntry, UNMEASURED_EXCEPTION_BASELINE } from "../version-one-records/exception-records.ts";
import { headRecordsOf } from "./head-records.ts";

const RECORDS_FILE = repoPathSchema.parse("discipline-exceptions.json");

const AUDIT = mechanismIdSchema.parse("audit");

const LOOPS = clauseAddressSchema.parse("CD-15#loops");

const SELECTION: Selection = {
  selected: [{ address: LOOPS, mechanism: AUDIT, exceptions: "allowed" }],
  uncovered: [],
  notAdopted: [],
  notRun: [],
  editions: [],
};

const AT_0 = { layout: "single-file", file: RECORDS_FILE, index: 0 } as const;

const AT_1 = { layout: "single-file", file: RECORDS_FILE, index: 1 } as const;

const AUTHORISED: PlacedEntry = {
  place: AT_0,
  entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" },
};

const CARVE_OUT: PlacedEntry = {
  place: AT_1,
  entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/b.ts", reason: "legacy loop" },
};

const headRecords = (request: { readonly entries: readonly PlacedEntry[] }) =>
  headRecordsOf({ entries: request.entries, selection: SELECTION, fileExceptionWhyChains: "optional", baseline: UNMEASURED_EXCEPTION_BASELINE });

describe("headRecordsOf", () => {
  it("pairs an authorised location with the entry as the file holds it", () => {
    expect(headRecords({ entries: [AUTHORISED] })).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "authorised-location",
          record: { kind: "authorised-location", clause: LOOPS, mechanism: AUDIT, file: "src/a.ts", reason: "kept" },
          entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" },
        },
      ],
    });
  });

  it("pairs a file carve-out with the entry as the file holds it, leaving its answer to the oracle", () => {
    expect(headRecords({ entries: [CARVE_OUT] })).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: { kind: "file-carve-out", clause: LOOPS, mechanism: AUDIT, file: "src/b.ts", reason: "legacy loop" },
          entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/b.ts", reason: "legacy loop" },
        },
      ],
    });
  });

  it("keeps the records in the order the file lists them", () => {
    expect(headRecords({ entries: [CARVE_OUT, AUTHORISED] })).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: { kind: "file-carve-out", clause: LOOPS, mechanism: AUDIT, file: "src/b.ts", reason: "legacy loop" },
          entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/b.ts", reason: "legacy loop" },
        },
        {
          kind: "authorised-location",
          record: { kind: "authorised-location", clause: LOOPS, mechanism: AUDIT, file: "src/a.ts", reason: "kept" },
          entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" },
        },
      ],
    });
  });

  it("refuses every invalid record of the file, naming where each sits", () => {
    expect(headRecords({ entries: [AUTHORISED, { place: AT_1, entry: { ...AUTHORISED.entry, reason: "kept again" } }] })).toEqual({
      outcome: "failed",
      error: [{ place: AT_1, problem: { kind: "duplicate", of: AT_0 } }],
    });
  });

  it("refuses an entry whose clause the selection does not run", () => {
    expect(headRecords({ entries: [{ place: AT_0, entry: { ...AUTHORISED.entry, clause: "CD-16#unselected" } }] })).toEqual({
      outcome: "failed",
      error: [{ place: AT_0, problem: { kind: "clause-not-selected", clause: clauseAddressSchema.parse("CD-16#unselected") } }],
    });
  });
});
