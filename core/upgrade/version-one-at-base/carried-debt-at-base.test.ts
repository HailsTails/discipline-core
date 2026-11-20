import { describe, expect, it } from "vitest";
import { SETTINGS_CATALOGUE } from "../../../tests/settings-catalogue.ts";
import type { RecordsDocument } from "../../records/hone-record.ts";
import type { RuleSetCatalogue } from "../../settings/check-choices.ts";
import { TOOL_RULE_SET } from "../../values/clause-address.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import { carriedDebtDocumentsAtBaseOf } from "./carried-debt-at-base.ts";
import type { VersionOneEntry } from "./version-one-entries.ts";

const CATALOGUES: readonly RuleSetCatalogue[] = [{ ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE }];

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/loop-keyword.json");

const CARVE_OUT: VersionOneEntry = {
  kind: "file-carve-out",
  clause: "CD-15#loops",
  file: "src/a.ts",
  reason: "legacy loop",
  whyChain: ["a", "b", "c", "d", "e"],
};

const AUTHORISED: VersionOneEntry = { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" };

const carriedDebtDocument = (request: { readonly records: readonly unknown[] }): RecordsDocument => ({
  file: DEBT_FILE,
  document: { version: 2, records: request.records },
});

const DEBT_OF_CARVE_OUT = { symptom: "loop-keyword#loops", file: "src/a.ts", carried: CARVE_OUT };

const documentsAtBase = (request: { readonly head: readonly RecordsDocument[]; readonly entries: readonly VersionOneEntry[] }) =>
  carriedDebtDocumentsAtBaseOf({ ...request, catalogues: CATALOGUES });

describe("carriedDebtDocumentsAtBaseOf establishing carried debt from the base's version 1 entries", () => {
  it("writes the carried debt record the base's carve-out entry, word for word, would have become", () => {
    expect(documentsAtBase({ head: [carriedDebtDocument({ records: [DEBT_OF_CARVE_OUT] })], entries: [CARVE_OUT] })).toEqual([
      carriedDebtDocument({ records: [DEBT_OF_CARVE_OUT] }),
    ]);
  });

  it("writes it although an authorised location holds the same clause and file at the base, as version 1 does not fail that", () => {
    expect(documentsAtBase({ head: [carriedDebtDocument({ records: [DEBT_OF_CARVE_OUT] })], entries: [AUTHORISED, CARVE_OUT] })).toEqual([
      carriedDebtDocument({ records: [DEBT_OF_CARVE_OUT] }),
    ]);
  });

  it("writes nothing for a carried entry edited since the base", () => {
    expect(
      documentsAtBase({ head: [carriedDebtDocument({ records: [{ ...DEBT_OF_CARVE_OUT, carried: { ...CARVE_OUT, reason: "edited" } }] })], entries: [CARVE_OUT] }),
    ).toEqual([]);
  });

  it("writes nothing when the base held no such entry", () => {
    expect(documentsAtBase({ head: [carriedDebtDocument({ records: [DEBT_OF_CARVE_OUT] })], entries: [] })).toEqual([]);
  });

  it("writes nothing for a whole-symptom carried debt, which reaches more than the one clause the entry excused", () => {
    expect(documentsAtBase({ head: [carriedDebtDocument({ records: [{ ...DEBT_OF_CARVE_OUT, symptom: "loop-keyword" }] })], entries: [CARVE_OUT] })).toEqual([]);
  });

  it("writes nothing for a carried debt at a check of another clause than the entry's", () => {
    expect(
      documentsAtBase({ head: [carriedDebtDocument({ records: [{ ...DEBT_OF_CARVE_OUT, symptom: "rebinding#test-body" }] })], entries: [CARVE_OUT] }),
    ).toEqual([]);
  });

  it("writes nothing for a carried debt at a file other than the entry's", () => {
    expect(documentsAtBase({ head: [carriedDebtDocument({ records: [{ ...DEBT_OF_CARVE_OUT, file: "src/b.ts" }] })], entries: [CARVE_OUT] })).toEqual([]);
  });

  it("writes nothing for a carried record whose entry is not a file carve-out, though the base held it word for word", () => {
    expect(
      documentsAtBase({ head: [carriedDebtDocument({ records: [{ ...DEBT_OF_CARVE_OUT, carried: AUTHORISED }] })], entries: [AUTHORISED] }),
    ).toEqual([]);
  });

  it("keeps only the records the base established, in a document of the file the head holds them in", () => {
    const edited = { ...DEBT_OF_CARVE_OUT, file: "src/b.ts", carried: { ...CARVE_OUT, file: "src/b.ts" } };
    expect(documentsAtBase({ head: [carriedDebtDocument({ records: [edited, DEBT_OF_CARVE_OUT] })], entries: [CARVE_OUT] })).toEqual([
      carriedDebtDocument({ records: [DEBT_OF_CARVE_OUT] }),
    ]);
  });

  it("writes nothing for a head document that is not a records document", () => {
    expect(documentsAtBase({ head: [{ file: DEBT_FILE, document: { not: "records" } }], entries: [CARVE_OUT] })).toEqual([]);
  });

  it("writes nothing for a record that is not a carried debt", () => {
    expect(documentsAtBase({ head: [carriedDebtDocument({ records: [{ symptom: "loop-keyword#loops", file: "src/a.ts", note: "stated" }] })], entries: [CARVE_OUT] })).toEqual(
      [],
    );
  });
});
