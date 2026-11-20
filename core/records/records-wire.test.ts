import { describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../tests/causal-why-chain.ts";
import {
  carriedAuthorisedLocationWireSchema,
  carriedFormSchema,
  debtWireSchema,
  recordsDocumentSchema,
  statedAuthorisedLocationWireSchema,
  statedBoundaryRecordWireSchema,
} from "./records-wire.ts";

describe("the version 2 records forms", () => {
  it("reads a records document of version 2", () => {
    expect(recordsDocumentSchema.safeParse({ version: 2, records: [{ symptom: "claimed-type" }] })).toMatchObject({
      success: true,
      data: { version: 2, records: [{ symptom: "claimed-type" }] },
    });
  });

  it("refuses a records document with a key beside version and records", () => {
    expect(recordsDocumentSchema.safeParse({ version: 2, records: [], exceptions: [] })).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ code: "unrecognized_keys", keys: ["exceptions"] })] },
    });
  });

  it("refuses a record with a key its kind does not state, such as a kind key the folder already gives", () => {
    expect(debtWireSchema.safeParse({ kind: "debt", symptom: "claimed-type", file: "src/a.ts" })).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ code: "unrecognized_keys", keys: ["kind"] })] },
    });
  });

  it("refuses a site that is not a repository path", () => {
    expect(debtWireSchema.safeParse({ symptom: "claimed-type", file: "../outside.ts" })).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ path: ["file"] })] },
    });
  });

  it("reads a symptom alone as a record reaching the whole symptom", () => {
    expect(debtWireSchema.safeParse({ symptom: "claimed-type", file: "src/a.ts" })).toMatchObject({
      success: true,
      data: { symptom: { reaches: "whole-symptom", symptom: "claimed-type" } },
    });
  });

  it("reads a symptom and one of its checks, written <symptom>#<check>, as a record reaching that check", () => {
    expect(statedAuthorisedLocationWireSchema.safeParse({ symptom: "claimed-type#cast-expressions", file: "src/a.ts", case: "gives-a-value-its-type", owes: "declared-not-asserted", whyChain: CAUSAL_WHY_CHAIN })).toMatchObject({
      success: true,
      data: { symptom: { reaches: "one-check", symptom: "claimed-type", check: "cast-expressions" } },
    });
  });

  it.each([{ symptom: "claimed-type#" }, { symptom: "#cast-expressions" }, { symptom: "claimed-type#cast-expressions#again" }, { symptom: "claimed-type#Cast" }])(
    "refuses $symptom as the symptom a record reaches",
    ({ symptom }) => {
      expect(carriedAuthorisedLocationWireSchema.safeParse({ symptom, file: "src/a.ts", carried: { kind: "authorised-location" } })).toMatchObject({
        success: false,
        error: { issues: [expect.objectContaining({ path: ["symptom"] })] },
      });
    },
  );

  it("refuses a boundary record that names no port", () => {
    expect(statedBoundaryRecordWireSchema.safeParse({ module: "src/adapters/files", outsideParty: "node:fs", ports: [] })).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ code: "too_small", path: ["ports"] })] },
    });
  });

  it.each([
    { outsideParty: "c:/Users/x" },
    { outsideParty: String.raw`c:\Users` },
    { outsideParty: "C:/Users/x" },
    { outsideParty: "file:///etc/x.js" },
    { outsideParty: "file:./local.ts" },
    { outsideParty: "./local.ts" },
    { outsideParty: "../src/x.ts" },
    { outsideParty: "/etc/x.js" },
    { outsideParty: "pkg/../../src/x" },
    { outsideParty: "pkg/./x" },
    { outsideParty: "@scope/pkg/../x" },
    { outsideParty: "npm:pkg/../x" },
  ])("refuses $outsideParty as an outside party, since it names a file by its path", ({ outsideParty }) => {
    expect(statedBoundaryRecordWireSchema.safeParse({ module: "src/adapters/files", outsideParty, ports: ["FileReader"] })).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ path: ["outsideParty"] })] },
    });
  });

  it.each([
    { outsideParty: "node:fs" },
    { outsideParty: "jsr:@std/path" },
    { outsideParty: "https://esm.sh/preact@10" },
    { outsideParty: "lodash/fp" },
    { outsideParty: "pkg/.config" },
    { outsideParty: "npm:@date-fns/tz@1.2.0/locale" },
  ])("accepts $outsideParty as an outside party", ({ outsideParty }) => {
    expect(statedBoundaryRecordWireSchema.safeParse({ module: "src/adapters/files", outsideParty, ports: ["FileReader"] }).success).toBe(true);
  });

  it.each([
    { entry: { symptom: "claimed-type", file: "src/a.ts", carried: { kind: "authorised-location" } }, form: true },
    { entry: { symptom: "claimed-type", file: "src/a.ts" }, form: false },
    { entry: "claimed-type", form: false },
  ])("tells a carried record by its carried key: $entry", ({ entry, form }) => {
    expect(carriedFormSchema.safeParse(entry).success).toBe(form);
  });
});
