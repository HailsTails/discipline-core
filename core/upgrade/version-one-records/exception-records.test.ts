import { assert, describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN, LEGACY_WHY_CHAIN } from "../../../tests/causal-why-chain.ts";
import type { Selection } from "../../consumer-selection/consumer-selection.ts";
import { clauseAddressSchema } from "../../values/clause-address.ts";
import { mechanismIdSchema } from "../../values/identifiers.ts";
import { type RepoPath, repoPathSchema } from "../../values/repo-path.ts";
import {
  authorisationStandingOf,
  type ExceptionBaseline,
  type ExceptionRecord,
  exceptionEntriesOfDocument,
  exceptionEntriesOfText,
  type ImportEvidence,
  legacyChainsIn,
  parseExceptionEntries,
  type PlacedEntry,
  recordImportOf,
  type StructuralExceptionEntry,
  UNMEASURED_EXCEPTION_BASELINE,
} from "./exception-records.ts";

const RECORDS_FILE = repoPathSchema.parse("discipline-exceptions.json");

const SELECTION: Selection = {
  selected: [
    { address: clauseAddressSchema.parse("CD-14#class-syntax"), mechanism: mechanismIdSchema.parse("audit"), exceptions: "allowed" },
    { address: clauseAddressSchema.parse("team/TM-1#no-tmp-files"), mechanism: mechanismIdSchema.parse("eslint"), exceptions: "allowed" },
  ],
  uncovered: [],
  notAdopted: [],
  notRun: [],
  editions: [],
};

const [FIRST_WHY, SECOND_WHY] = CAUSAL_WHY_CHAIN.whys;

const SHORT_CHAIN = { ...CAUSAL_WHY_CHAIN, whys: [FIRST_WHY, SECOND_WHY] };

const CLASS_SYNTAX = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };

const LOCATION = {
  kind: "authorised-location",
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture exception-records.test.ts#LOCATION; not historical authorisation" },
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "the wrapping factory for the library",
} as const;

const FILE_CARVE_OUT = {
  kind: "file-carve-out",
  clause: "CD-14#class-syntax",
  file: "src/legacy.ts",
  reason: "legacy class awaiting paydown",
  whyChain: CAUSAL_WHY_CHAIN,
} as const;

const CLAUSE_WIDE = {
  kind: "clause-wide-carve-out",
  clause: "team/TM-1#no-tmp-files",
  reason: "the whole clause is held",
  whyChain: CAUSAL_WHY_CHAIN,
} as const;

const AT_0 = { layout: "single-file", file: RECORDS_FILE, index: 0 } as const;

const AT_1 = { layout: "single-file", file: RECORDS_FILE, index: 1 } as const;

const AT_2 = { layout: "single-file", file: RECORDS_FILE, index: 2 } as const;

const AT_3 = { layout: "single-file", file: RECORDS_FILE, index: 3 } as const;

const AT_4 = { layout: "single-file", file: RECORDS_FILE, index: 4 } as const;

const AT_5 = { layout: "single-file", file: RECORDS_FILE, index: 5 } as const;

const AT_6 = { layout: "single-file", file: RECORDS_FILE, index: 6 } as const;

const AT_7 = { layout: "single-file", file: RECORDS_FILE, index: 7 } as const;

const AT_8 = { layout: "single-file", file: RECORDS_FILE, index: 8 } as const;

const AT_9 = { layout: "single-file", file: RECORDS_FILE, index: 9 } as const;

const FICTIONAL_LOCATION_INPUT = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "fictional authorisation evidence input",
} as const;

const FICTIONAL_AUTHORISATION_PROVENANCE = {
  kind: "existing-authorisation",
  source: "fictional unit input exception-records.test.ts; not historical authorisation",
  decision: "fictional fixture assertion; grants no permission",
} as const;

const FICTIONAL_DEBT_PROVENANCE = {
  kind: "inherited-debt",
  source: "fictional unit input exception-records.test.ts; not historical debt",
  decision: "fictional initial baseline assertion; not a live debt decision",
} as const;

const LEGACY_CHAIN_LOCATION = { ...FICTIONAL_LOCATION_INPUT, whyChain: LEGACY_WHY_CHAIN } as const;

const CAUSAL_CHAIN_LOCATION = { ...FICTIONAL_LOCATION_INPUT, whyChain: CAUSAL_WHY_CHAIN } as const;

const LEGACY_LOCATION_UNCHANGED_AT_BASE: ExceptionBaseline = { measured: "yes", entriesAtBase: [LEGACY_CHAIN_LOCATION], sourceTextsAtBase: new Map() };

describe("authorisationStandingOf, from the same judgement that accepted the record", () => {
  it.each([
    { name: "a legacy chain accepted while the base went unread", entry: LEGACY_CHAIN_LOCATION, baseline: UNMEASURED_EXCEPTION_BASELINE, standing: "provisional" },
    { name: "an imported location accepted while the base went unread", entry: LOCATION, baseline: UNMEASURED_EXCEPTION_BASELINE, standing: "provisional" },
    { name: "a legacy chain the base holds unchanged", entry: LEGACY_CHAIN_LOCATION, baseline: LEGACY_LOCATION_UNCHANGED_AT_BASE, standing: "established" },
    { name: "a causal chain, judged in full while the base went unread", entry: CAUSAL_CHAIN_LOCATION, baseline: UNMEASURED_EXCEPTION_BASELINE, standing: "established" },
    { name: "a reason alone, judged in full while the base went unread", entry: FICTIONAL_LOCATION_INPUT, baseline: UNMEASURED_EXCEPTION_BASELINE, standing: "established" },
  ] as const)("is $standing for $name", ({ entry, baseline, standing }) => {
    const reading = parseExceptionEntries({ entries: [{ place: AT_0, entry }], selection: SELECTION, fileExceptionWhyChains: "optional", baseline });
    const [record] = reading.records;
    assert.isDefined(record, "the parse accepts the record");
    expect({ invalid: reading.invalid, standing: authorisationStandingOf({ record, baseline }) }).toEqual({ invalid: [], standing });
  });
});

describe("parseExceptionEntries records", () => {
  it("parses an authorised location with the mechanism copied from the selection", () => {
    expect(parseExceptionEntries({ entries: [{ place: AT_0, entry: LOCATION }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE })).toEqual({
      records: [
        { kind: "authorised-location", clause: CLASS_SYNTAX, mechanism: "audit", file: "src/factory.ts", reason: LOCATION.reason, provenance: LOCATION.provenance },
      ],
      invalid: [],
    });
  });

  it("parses a file carve-out with its why-chain", () => {
    expect(parseExceptionEntries({ entries: [{ place: AT_0, entry: FILE_CARVE_OUT }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE })).toEqual({
      records: [
        {
          kind: "file-carve-out",
          clause: CLASS_SYNTAX,
          mechanism: "audit",
          file: "src/legacy.ts",
          reason: FILE_CARVE_OUT.reason,
          whyChain: CAUSAL_WHY_CHAIN,
        },
      ],
      invalid: [],
    });
  });

  it("parses a clause-wide carve-out in a named rule set with that clause's mechanism", () => {
    expect(parseExceptionEntries({ entries: [{ place: AT_0, entry: CLAUSE_WIDE }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE })).toEqual({
      records: [
        {
          kind: "clause-wide-carve-out",
          clause: { ruleSet: { name: "team" }, discipline: "TM-1", clause: "no-tmp-files" },
          mechanism: "eslint",
          reason: CLAUSE_WIDE.reason,
          whyChain: CAUSAL_WHY_CHAIN,
        },
      ],
      invalid: [],
    });
  });

  it("keeps two entries of different kinds for the same clause and file as two records", () => {
    const carveOut = { ...FILE_CARVE_OUT, file: "src/factory.ts" };

    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: LOCATION }, { place: AT_1, entry: carveOut }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }).invalid,
    ).toEqual([]);
  });

  it("keeps two entries of the same kind and clause for different files as two records", () => {
    const other = { ...LOCATION, file: "src/other-factory.ts" };

    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: LOCATION }, { place: AT_1, entry: other }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }).records,
    ).toHaveLength(2);
  });
});

describe("parseExceptionEntries invalid records", () => {
  it("is clause-unparseable for a clause that is not a clause address", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: { ...LOCATION, clause: "CD-14 class-syntax" } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }),
    ).toMatchObject({
      records: [],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "clause-unparseable", detail: expect.stringMatching(/.+/) } }],
    });
  });

  it("is clause-not-selected for a clause the selection does not hold", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: { ...LOCATION, clause: "CD-14#abstract-syntax" } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }),
    ).toEqual({
      records: [],
      invalid: [
        {
          place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 },
          problem: { kind: "clause-not-selected", clause: { ruleSet: "hone", discipline: "CD-14", clause: "abstract-syntax" } },
        },
      ],
    });
  });

  it("is clause-not-run for a clause the selection adopts with its mechanism not run", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: { ...LOCATION, clause: "CD-14#abstract-syntax" } }],
        selection: { ...SELECTION, notRun: [clauseAddressSchema.parse("CD-14#abstract-syntax")] },
        fileExceptionWhyChains: "required",
        baseline: UNMEASURED_EXCEPTION_BASELINE,
      }),
    ).toEqual({
      records: [],
      invalid: [
        {
          place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 },
          problem: { kind: "clause-not-run", clause: { ruleSet: "hone", discipline: "CD-14", clause: "abstract-syntax" } },
        },
      ],
    });
  });

  it("is clause-not-adopted for a clause the selection declares not adopted", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: { ...LOCATION, clause: "CD-14#abstract-syntax" } }],
        selection: { ...SELECTION, notAdopted: [clauseAddressSchema.parse("CD-14#abstract-syntax")] },
        fileExceptionWhyChains: "required",
        baseline: UNMEASURED_EXCEPTION_BASELINE,
      }),
    ).toEqual({
      records: [],
      invalid: [
        {
          place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 },
          problem: { kind: "clause-not-adopted", clause: { ruleSet: "hone", discipline: "CD-14", clause: "abstract-syntax" } },
        },
      ],
    });
  });

  it("is file-not-repo-path for a file that is not a RepoPath", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: { ...LOCATION, file: "../factory.ts" } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }),
    ).toEqual({
      records: [],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "file-not-repo-path", file: "../factory.ts" } }],
    });
  });

  it("is why-chain-refused for a file carve-out whose chain is refused", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: { ...FILE_CARVE_OUT, whyChain: SHORT_CHAIN } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }),
    ).toMatchObject({
      records: [],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused", detail: expect.stringMatching(/.+/) } }],
    });
  });

  it("is why-chain-refused for a clause-wide carve-out whose chain is refused", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: { ...CLAUSE_WIDE, whyChain: "because" } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }),
    ).toMatchObject({
      records: [],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused" } }],
    });
  });

  it("is a duplicate of the earlier valid entry with the same kind, clause and file", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: LOCATION }, { place: AT_1, entry: { ...LOCATION, reason: "said again" } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }),
    ).toMatchObject({
      records: [{ kind: "authorised-location", file: "src/factory.ts", reason: LOCATION.reason }],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 1 }, problem: { kind: "duplicate", of: { layout: "single-file", file: "discipline-exceptions.json", index: 0 } } }],
    });
  });

  it("is a duplicate of an earlier bare entry when written with the hone prefix", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: LOCATION }, { place: AT_1, entry: { ...LOCATION, clause: "hone/CD-14#class-syntax" } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }).invalid,
    ).toEqual([{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 1 }, problem: { kind: "duplicate", of: { layout: "single-file", file: "discipline-exceptions.json", index: 0 } } }]);
  });

  it("is a record for the bare clause when written with the hone prefix", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: { ...LOCATION, clause: "hone/CD-14#class-syntax" } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }).records,
    ).toMatchObject([{ clause: CLASS_SYNTAX }]);
  });

  it("is a duplicate of an earlier clause-wide carve-out for the same clause", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: CLAUSE_WIDE }, { place: AT_1, entry: CLAUSE_WIDE }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }).invalid,
    ).toEqual([{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 1 }, problem: { kind: "duplicate", of: { layout: "single-file", file: "discipline-exceptions.json", index: 0 } } }]);
  });

  it("is not a duplicate of an earlier entry that was itself invalid", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: { ...FILE_CARVE_OUT, whyChain: SHORT_CHAIN } }, { place: AT_1, entry: FILE_CARVE_OUT }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: UNMEASURED_EXCEPTION_BASELINE,
      }),
    ).toMatchObject({
      records: [{ kind: "file-carve-out", file: "src/legacy.ts" }],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused" } }],
    });
  });

  it("gives each invalid entry its position in the entries", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: LOCATION }, { place: AT_1, entry: FILE_CARVE_OUT }, { place: AT_2, entry: { ...LOCATION, file: "/abs/factory.ts" } }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: UNMEASURED_EXCEPTION_BASELINE,
      }).invalid,
    ).toEqual([{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 2 }, problem: { kind: "file-not-repo-path", file: "/abs/factory.ts" } }]);
  });
});

describe("canonical exception evidence", () => {
  it("preserves chain-only provenance-only and both forms for authorisation and file debt in input order", () => {
    const exceptionReading = parseExceptionEntries({ entries: [{ place: AT_0, entry: { ...FICTIONAL_LOCATION_INPUT, file: "src/authorisation-chain.ts", whyChain: CAUSAL_WHY_CHAIN } }, { place: AT_1, entry: { ...FICTIONAL_LOCATION_INPUT, file: "src/authorisation-provenance.ts", provenance: { kind: "existing-authorisation", source: FICTIONAL_AUTHORISATION_PROVENANCE.source } } }, { place: AT_2, entry: { ...FICTIONAL_LOCATION_INPUT, file: "src/authorisation-both.ts", whyChain: CAUSAL_WHY_CHAIN, provenance: FICTIONAL_AUTHORISATION_PROVENANCE } }, { place: AT_3, entry: FILE_CARVE_OUT }, { place: AT_4, entry: { kind: "file-carve-out", clause: "CD-14#class-syntax", file: "src/debt-provenance.ts", reason: FILE_CARVE_OUT.reason, provenance: FICTIONAL_DEBT_PROVENANCE } }, { place: AT_5, entry: { ...FILE_CARVE_OUT, file: "src/debt-both.ts", provenance: FICTIONAL_DEBT_PROVENANCE } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE });

    expect(exceptionReading).toEqual({ records: [
      { kind: "authorised-location", clause: CLASS_SYNTAX, mechanism: "audit", file: "src/authorisation-chain.ts", reason: FICTIONAL_LOCATION_INPUT.reason, whyChain: CAUSAL_WHY_CHAIN },
      { kind: "authorised-location", clause: CLASS_SYNTAX, mechanism: "audit", file: "src/authorisation-provenance.ts", reason: FICTIONAL_LOCATION_INPUT.reason, provenance: { kind: "existing-authorisation", source: FICTIONAL_AUTHORISATION_PROVENANCE.source } },
      { kind: "authorised-location", clause: CLASS_SYNTAX, mechanism: "audit", file: "src/authorisation-both.ts", reason: FICTIONAL_LOCATION_INPUT.reason, whyChain: CAUSAL_WHY_CHAIN, provenance: FICTIONAL_AUTHORISATION_PROVENANCE },
      { kind: "file-carve-out", clause: CLASS_SYNTAX, mechanism: "audit", file: "src/legacy.ts", reason: FILE_CARVE_OUT.reason, whyChain: CAUSAL_WHY_CHAIN },
      { kind: "file-carve-out", clause: CLASS_SYNTAX, mechanism: "audit", file: "src/debt-provenance.ts", reason: FILE_CARVE_OUT.reason, provenance: FICTIONAL_DEBT_PROVENANCE },
      { kind: "file-carve-out", clause: CLASS_SYNTAX, mechanism: "audit", file: "src/debt-both.ts", reason: FILE_CARVE_OUT.reason, whyChain: CAUSAL_WHY_CHAIN, provenance: FICTIONAL_DEBT_PROVENANCE },
    ], invalid: [] });
  });

  it("refuses authorisation with neither evidence form at its original index, and holds file debt with neither as debt", () => {
    expect(parseExceptionEntries({ entries: [{ place: AT_0, entry: FICTIONAL_LOCATION_INPUT }, { place: AT_1, entry: { kind: "file-carve-out", clause: "CD-14#class-syntax", file: "src/legacy.ts", reason: FILE_CARVE_OUT.reason } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE })).toEqual({
      records: [{ kind: "file-carve-out", clause: CLASS_SYNTAX, mechanism: "audit", file: "src/legacy.ts", reason: FILE_CARVE_OUT.reason }],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "evidence-refused", detail: expect.any(String) } }],
    });
  });

  it("keeps malformed coexistence nonblank and strict-provenance failures indexed without discarding either supplied form", () => {
    expect(parseExceptionEntries({ entries: [{ place: AT_0, entry: CLAUSE_WIDE }, { place: AT_1, entry: { ...FICTIONAL_LOCATION_INPUT, whyChain: SHORT_CHAIN, provenance: FICTIONAL_AUTHORISATION_PROVENANCE } }, { place: AT_2, entry: { ...FICTIONAL_LOCATION_INPUT, whyChain: CAUSAL_WHY_CHAIN, provenance: { ...FICTIONAL_AUTHORISATION_PROVENANCE, source: " \t " } } }, { place: AT_3, entry: { ...FICTIONAL_LOCATION_INPUT, whyChain: CAUSAL_WHY_CHAIN, provenance: { ...FICTIONAL_AUTHORISATION_PROVENANCE, decision: " \n " } } }, { place: AT_4, entry: { ...FICTIONAL_LOCATION_INPUT, whyChain: CAUSAL_WHY_CHAIN, provenance: { ...FICTIONAL_AUTHORISATION_PROVENANCE, permission: "extra field" } } }, { place: AT_5, entry: { ...FILE_CARVE_OUT, whyChain: SHORT_CHAIN, provenance: FICTIONAL_DEBT_PROVENANCE } }, { place: AT_6, entry: { ...FILE_CARVE_OUT, provenance: FICTIONAL_AUTHORISATION_PROVENANCE } }, { place: AT_7, entry: { kind: "file-carve-out", clause: "CD-14#class-syntax", file: "src/debt-missing-decision.ts", reason: FILE_CARVE_OUT.reason, provenance: { kind: "inherited-debt", source: FICTIONAL_DEBT_PROVENANCE.source } } }, { place: AT_8, entry: { kind: "file-carve-out", clause: "CD-14#class-syntax", file: "src/debt-blank-decision.ts", reason: FILE_CARVE_OUT.reason, provenance: { ...FICTIONAL_DEBT_PROVENANCE, decision: " \t " } } }, { place: AT_9, entry: { ...FICTIONAL_LOCATION_INPUT, provenance: FICTIONAL_DEBT_PROVENANCE } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE })).toEqual({
      records: [{ kind: "clause-wide-carve-out", clause: { ruleSet: { name: "team" }, discipline: "TM-1", clause: "no-tmp-files" }, mechanism: "eslint", reason: CLAUSE_WIDE.reason, whyChain: CAUSAL_WHY_CHAIN }],
      invalid: [
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 1 }, problem: { kind: "why-chain-refused", detail: expect.any(String) } },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 2 }, problem: { kind: "evidence-refused", detail: expect.any(String) } },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 3 }, problem: { kind: "evidence-refused", detail: expect.any(String) } },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 4 }, problem: { kind: "evidence-refused", detail: expect.any(String) } },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 5 }, problem: { kind: "why-chain-refused", detail: expect.any(String) } },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 6 }, problem: { kind: "evidence-refused", detail: expect.any(String) } },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 7 }, problem: { kind: "evidence-refused", detail: expect.any(String) } },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 8 }, problem: { kind: "evidence-refused", detail: expect.any(String) } },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 9 }, problem: { kind: "evidence-refused", detail: expect.any(String) } },
      ],
    });
  });

  it("keeps first valid identity original indexes and authorisation versus debt distinction across evidence forms", () => {
    expect(parseExceptionEntries({ entries: [{ place: AT_0, entry: FICTIONAL_LOCATION_INPUT }, { place: AT_1, entry: { ...FICTIONAL_LOCATION_INPUT, provenance: FICTIONAL_AUTHORISATION_PROVENANCE } }, { place: AT_2, entry: { ...FICTIONAL_LOCATION_INPUT, whyChain: CAUSAL_WHY_CHAIN, provenance: FICTIONAL_AUTHORISATION_PROVENANCE } }, { place: AT_3, entry: { kind: "file-carve-out", clause: "CD-14#class-syntax", file: FICTIONAL_LOCATION_INPUT.file, reason: FILE_CARVE_OUT.reason, provenance: FICTIONAL_DEBT_PROVENANCE } }, { place: AT_4, entry: { ...FILE_CARVE_OUT, file: FICTIONAL_LOCATION_INPUT.file, provenance: FICTIONAL_DEBT_PROVENANCE } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE })).toEqual({
      records: [
        { kind: "authorised-location", clause: CLASS_SYNTAX, mechanism: "audit", file: FICTIONAL_LOCATION_INPUT.file, reason: FICTIONAL_LOCATION_INPUT.reason, provenance: FICTIONAL_AUTHORISATION_PROVENANCE },
        { kind: "file-carve-out", clause: CLASS_SYNTAX, mechanism: "audit", file: FICTIONAL_LOCATION_INPUT.file, reason: FILE_CARVE_OUT.reason, provenance: FICTIONAL_DEBT_PROVENANCE },
      ],
      invalid: [
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "evidence-refused", detail: expect.any(String) } },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 2 }, problem: { kind: "duplicate", of: { layout: "single-file", file: "discipline-exceptions.json", index: 1 } } },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 4 }, problem: { kind: "duplicate", of: { layout: "single-file", file: "discipline-exceptions.json", index: 3 } } },
      ],
    });
  });
});

describe("non-exemptibility at the canonical boundary, for a clause whose discipline refuses exceptions", () => {
  it.each([
    { kind: "authorised-location", clause: "CD-1#any-cast", file: "src/unsafe.ts", reason: "fictional non-exemptibility input", whyChain: CAUSAL_WHY_CHAIN },
    { kind: "file-carve-out", clause: "CD-1#any-cast", file: "src/unsafe.ts", reason: "fictional non-exemptibility input", whyChain: CAUSAL_WHY_CHAIN },
    { kind: "clause-wide-carve-out", clause: "CD-1#any-cast", reason: "fictional non-exemptibility input", whyChain: CAUSAL_WHY_CHAIN },
  ] as const)("refuses an adopted any clause for $kind", (entry) => {
    expect(parseExceptionEntries({ entries: [{ place: AT_0, entry: entry }], selection: { selected: [{ address: clauseAddressSchema.parse("CD-1#any-cast"), mechanism: mechanismIdSchema.parse("audit"), exceptions: "refused" }], uncovered: [], notAdopted: [], notRun: [], editions: [] }, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE })).toEqual({ records: [], invalid: [
      { place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "non-exemptible-clause", clause: { ruleSet: "hone", discipline: "CD-1", clause: "any-cast" } } },
    ] });
  });
});

const IMPORT_SOURCE = repoPathSchema.parse(".constitution-carve-outs/cd-14.json");

const IMPORTED_CARVE_OUT = {
  kind: "file-carve-out",
  clause: "CD-14#class-syntax",
  file: "src/legacy.ts",
  reason: "legacy class awaiting paydown",
  provenance: { kind: "inherited-debt", source: `${IMPORT_SOURCE}#0`, decision: "fictional migration fixture; not a live debt decision" },
} as const;

const IMPORTED_RECORD = {
  kind: "file-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: "audit",
  file: "src/legacy.ts",
  reason: IMPORTED_CARVE_OUT.reason,
  provenance: IMPORTED_CARVE_OUT.provenance,
};

const baselineHolding = (request: {
  readonly entriesAtBase: readonly StructuralExceptionEntry[];
  readonly sourceTextsAtBase: ReadonlyMap<RepoPath, string>;
}): ExceptionBaseline => ({ measured: "yes", ...request });

const NOTHING_AT_BASE = baselineHolding({ entriesAtBase: [], sourceTextsAtBase: new Map() });

describe("parseExceptionEntries imported records against the base revision", () => {
  it("accepts an imported record without a why-chain when base holds the same entry", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: IMPORTED_CARVE_OUT }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({ entriesAtBase: [IMPORTED_CARVE_OUT], sourceTextsAtBase: new Map() }),
      }),
    ).toEqual({ records: [IMPORTED_RECORD], invalid: [] });
  });

  it("accepts an imported record without a why-chain when its provenance source lists the file at base", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: IMPORTED_CARVE_OUT }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({
          entriesAtBase: [],
          sourceTextsAtBase: new Map([[IMPORT_SOURCE, '[{ "files": ["src/legacy.ts"], "reason": "inherited" }]']]),
        }),
      }),
    ).toEqual({ records: [IMPORTED_RECORD], invalid: [] });
  });

  it("refuses a new record without a why-chain whose provenance source is not at base", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: IMPORTED_CARVE_OUT }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: NOTHING_AT_BASE }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "import-unverified" } }] });
  });

  it.each([
    { entry: IMPORTED_CARVE_OUT, way: "give it a whyChain, or remove its provenance to keep it as debt" },
    { entry: LOCATION, way: "give it a whyChain" },
  ])("names the way out for an unverified $entry.kind import", ({ entry, way }) => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: NOTHING_AT_BASE }).invalid,
    ).toEqual([{ place: AT_0, problem: { kind: "import-unverified", detail: expect.stringMatching(new RegExp(`: ${way}$`)) } }]);
  });

  it("refuses a new record without a why-chain whose provenance source at base does not list the file", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: IMPORTED_CARVE_OUT }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({ entriesAtBase: [], sourceTextsAtBase: new Map([[IMPORT_SOURCE, '[{ "files": ["src/other.ts"] }]']]) }),
      }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "import-unverified" } }] });
  });

  it("refuses an imported record edited since base until it carries a why-chain", () => {
    const baseline = baselineHolding({ entriesAtBase: [IMPORTED_CARVE_OUT], sourceTextsAtBase: new Map() });
    const edited = { ...IMPORTED_CARVE_OUT, reason: "legacy class, now partly paid down" };

    expect(parseExceptionEntries({ entries: [{ place: AT_0, entry: edited }], selection: SELECTION, fileExceptionWhyChains: "required", baseline })).toMatchObject({
      records: [],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "import-unverified" } }],
    });
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: { ...edited, whyChain: CAUSAL_WHY_CHAIN } }], selection: SELECTION, fileExceptionWhyChains: "required", baseline }).invalid,
    ).toEqual([]);
  });

  it("refuses a new record whose provenance source mentions the file outside any entry's files", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: IMPORTED_CARVE_OUT }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({
          entriesAtBase: [],
          sourceTextsAtBase: new Map([[IMPORT_SOURCE, '[{ "files": ["src/other.ts"], "reason": "src/legacy.ts was paid down" }]']]),
        }),
      }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "import-unverified" } }] });
  });

  it("refuses a new record whose provenance source entry index lists a different file", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: { ...IMPORTED_CARVE_OUT, provenance: { ...IMPORTED_CARVE_OUT.provenance, source: `${IMPORT_SOURCE}#1` } } }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({
          entriesAtBase: [],
          sourceTextsAtBase: new Map([[IMPORT_SOURCE, '[{ "files": ["src/legacy.ts"] }, { "files": ["src/other.ts"] }]']]),
        }),
      }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "import-unverified" } }] });
  });

  it("refuses a new record whose provenance source belongs to a different discipline", () => {
    const otherDisciplineSource = repoPathSchema.parse(".constitution-carve-outs/cd-15.json");

    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: { ...IMPORTED_CARVE_OUT, provenance: { ...IMPORTED_CARVE_OUT.provenance, source: `${otherDisciplineSource}#0` } } }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({
          entriesAtBase: [],
          sourceTextsAtBase: new Map([[otherDisciplineSource, '[{ "files": ["src/legacy.ts"] }]']]),
        }),
      }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "import-unverified" } }] });
  });

  it("refuses a carve-out imported from an authorised-locations source", () => {
    const authorisationSource = repoPathSchema.parse(".constitution-authorised-locations/cd-14.json");

    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: { ...IMPORTED_CARVE_OUT, provenance: { ...IMPORTED_CARVE_OUT.provenance, source: `${authorisationSource}#0` } } }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({
          entriesAtBase: [],
          sourceTextsAtBase: new Map([[authorisationSource, '[{ "files": ["src/legacy.ts"] }]']]),
        }),
      }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "import-unverified" } }] });
  });

  it("refuses an imported record edited since base even while its provenance source still lists the file", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: { ...IMPORTED_CARVE_OUT, reason: "legacy class, now partly paid down" } }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({
          entriesAtBase: [IMPORTED_CARVE_OUT],
          sourceTextsAtBase: new Map([[IMPORT_SOURCE, '[{ "files": ["src/legacy.ts"] }]']]),
        }),
      }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "import-unverified" } }] });
  });

  it("refuses an import for a clause whose discipline refuses exceptions", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: { ...IMPORTED_CARVE_OUT, clause: "CD-1#any-cast" } }],
        selection: { selected: [{ address: clauseAddressSchema.parse("CD-1#any-cast"), mechanism: mechanismIdSchema.parse("audit"), exceptions: "refused" }], uncovered: [], notAdopted: [], notRun: [], editions: [] },
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({ entriesAtBase: [IMPORTED_CARVE_OUT], sourceTextsAtBase: new Map() }),
      }),
    ).toEqual({
      records: [],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "non-exemptible-clause", clause: { ruleSet: "hone", discipline: "CD-1", clause: "any-cast" } } }],
    });
  });

  it("accepts an imported record without a why-chain while the base is unmeasured", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: IMPORTED_CARVE_OUT }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }),
    ).toEqual({ records: [IMPORTED_RECORD], invalid: [] });
  });
});

const REASONED_LOCATION = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "the wrapping factory for the library",
} as const;

const REASONED_CARVE_OUT = {
  kind: "file-carve-out",
  clause: "CD-14#class-syntax",
  file: "src/legacy.ts",
  reason: "legacy class awaiting paydown",
} as const;

const REASONED_CLAUSE_WIDE = {
  kind: "clause-wide-carve-out",
  clause: "team/TM-1#no-tmp-files",
  reason: "the whole clause is held",
} as const;

const parsedWithOptionalWhyChains = (request: {
  readonly entries: readonly PlacedEntry[];
  readonly baseline: ExceptionBaseline;
}) => parseExceptionEntries({ ...request, selection: SELECTION, fileExceptionWhyChains: "optional" });

describe("parseExceptionEntries when file exception why-chains are optional", () => {
  it("accepts an authorised location and a file carve-out that give only a reason", () => {
    expect(
      parsedWithOptionalWhyChains({ entries: [{ place: AT_0, entry: REASONED_LOCATION }, { place: AT_1, entry: REASONED_CARVE_OUT }], baseline: UNMEASURED_EXCEPTION_BASELINE }),
    ).toEqual({
      records: [
        { ...REASONED_LOCATION, clause: CLASS_SYNTAX, mechanism: "audit" },
        { ...REASONED_CARVE_OUT, clause: CLASS_SYNTAX, mechanism: "audit" },
      ],
      invalid: [],
    });
  });

  it("accepts a reason-only record that is new since a base revision holding no exceptions", () => {
    expect(parsedWithOptionalWhyChains({ entries: [{ place: AT_0, entry: REASONED_LOCATION }, { place: AT_1, entry: REASONED_CARVE_OUT }], baseline: NOTHING_AT_BASE }).invalid).toEqual([]);
  });

  it("refuses a reason-only authorised location whose reason is blank", () => {
    expect(
      parsedWithOptionalWhyChains({ entries: [{ place: AT_0, entry: { ...REASONED_LOCATION, reason: "" } }, { place: AT_1, entry: { ...REASONED_LOCATION, file: "src/blank.ts", reason: " \t " } }], baseline: UNMEASURED_EXCEPTION_BASELINE }),
    ).toEqual({
      records: [],
      invalid: [
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "evidence-refused", detail: expect.any(String) } },
        { place: { layout: "single-file", file: "discipline-exceptions.json", index: 1 }, problem: { kind: "evidence-refused", detail: expect.any(String) } },
      ],
    });
  });

  it.each([
    ["authorised location", REASONED_LOCATION],
    ["file carve-out", REASONED_CARVE_OUT],
  ] as const)("judges a reason-only-shaped %s that also carries a why-chain on that chain", (_label, entry) => {
    expect(
      parsedWithOptionalWhyChains({ entries: [{ place: AT_0, entry: { ...entry, whyChain: SHORT_CHAIN } }, { place: AT_1, entry: { ...entry, file: "src/chained.ts", whyChain: CAUSAL_WHY_CHAIN } }], baseline: UNMEASURED_EXCEPTION_BASELINE }),
    ).toEqual({
      records: [{ ...entry, file: "src/chained.ts", clause: CLASS_SYNTAX, mechanism: "audit", whyChain: CAUSAL_WHY_CHAIN }],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused", detail: expect.any(String) } }],
    });
  });

  it("keeps a blank reason beside a why-chain as it is while file exception why-chains are required", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: { ...FILE_CARVE_OUT, reason: "" } }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: UNMEASURED_EXCEPTION_BASELINE,
      }).invalid,
    ).toEqual([]);
  });

  it("still verifies provenance a file record supplies against the base revision", () => {
    expect(parsedWithOptionalWhyChains({ entries: [{ place: AT_0, entry: IMPORTED_CARVE_OUT }], baseline: NOTHING_AT_BASE })).toMatchObject({
      records: [],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "import-unverified" } }],
    });
  });

  it("still refuses malformed provenance a file record supplies", () => {
    expect(
      parsedWithOptionalWhyChains({
        entries: [{ place: AT_0, entry: { ...REASONED_CARVE_OUT, provenance: { ...FICTIONAL_DEBT_PROVENANCE, decision: " \t " } } }],
        baseline: UNMEASURED_EXCEPTION_BASELINE,
      }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "evidence-refused" } }] });
  });

  it("still judges a clause-wide carve-out's why-chain", () => {
    expect(
      parsedWithOptionalWhyChains({ entries: [{ place: AT_0, entry: { ...REASONED_CLAUSE_WIDE, whyChain: "because" } }], baseline: UNMEASURED_EXCEPTION_BASELINE }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused" } }] });
  });

  it("still refuses a reason-only record for a clause whose discipline refuses exceptions", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: { ...REASONED_CARVE_OUT, clause: "CD-1#any-cast" } }],
        selection: { selected: [{ address: clauseAddressSchema.parse("CD-1#any-cast"), mechanism: mechanismIdSchema.parse("audit"), exceptions: "refused" }], uncovered: [], notAdopted: [], notRun: [], editions: [] },
        fileExceptionWhyChains: "optional",
        baseline: UNMEASURED_EXCEPTION_BASELINE,
      }).invalid,
    ).toEqual([{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "non-exemptible-clause", clause: { ruleSet: "hone", discipline: "CD-1", clause: "any-cast" } } }]);
  });

  it("refuses a reason-only authorised location as evidence-refused while file exception why-chains are required", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: REASONED_LOCATION }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: NOTHING_AT_BASE,
      }),
    ).toEqual({
      records: [],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "evidence-refused", detail: expect.any(String) } }],
    });
  });
});

describe("parseExceptionEntries holds a file carve-out as debt, which needs no why-chain whatever fileExceptionWhyChains says", () => {
  it.each(["required", "optional"] as const)("accepts a reason-only file carve-out while file exception why-chains are %s", (fileExceptionWhyChains) => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: REASONED_CARVE_OUT }], selection: SELECTION, fileExceptionWhyChains, baseline: NOTHING_AT_BASE }),
    ).toEqual({ records: [{ ...REASONED_CARVE_OUT, clause: CLASS_SYNTAX, mechanism: "audit" }], invalid: [] });
  });

  it.each(["required", "optional"] as const)("accepts a file carve-out that gives no reason, or a blank one, while file exception why-chains are %s", (fileExceptionWhyChains) => {
    const bare = { kind: "file-carve-out", clause: "CD-14#class-syntax", file: "src/legacy.ts" } as const;

    expect(
      parseExceptionEntries({
        entries: [
          { place: AT_0, entry: bare },
          { place: AT_1, entry: { ...bare, file: "src/blank.ts", reason: " " } },
        ],
        selection: SELECTION,
        fileExceptionWhyChains,
        baseline: NOTHING_AT_BASE,
      }),
    ).toEqual({
      records: [
        { ...bare, clause: CLASS_SYNTAX, mechanism: "audit" },
        { ...bare, file: "src/blank.ts", reason: " ", clause: CLASS_SYNTAX, mechanism: "audit" },
      ],
      invalid: [],
    });
  });

  it("accepts a file carve-out with a why-chain and no reason", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: { kind: "file-carve-out", clause: "CD-14#class-syntax", file: "src/legacy.ts", whyChain: CAUSAL_WHY_CHAIN } }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: UNMEASURED_EXCEPTION_BASELINE,
      }).invalid,
    ).toEqual([]);
  });

  it("reads a records document whose file carve-out gives no reason", () => {
    expect(
      exceptionEntriesOfDocument({ document: { version: 1, exceptions: [{ kind: "file-carve-out", clause: "CD-14#class-syntax", file: "src/legacy.ts" }] } }),
    ).toEqual({ outcome: "ok", value: [{ kind: "file-carve-out", clause: "CD-14#class-syntax", file: "src/legacy.ts" }] });
  });

  it.each([
    { kind: "authorised-location", clause: "CD-14#class-syntax", file: "src/factory.ts", whyChain: CAUSAL_WHY_CHAIN },
    { kind: "clause-wide-carve-out", clause: "CD-14#class-syntax", whyChain: CAUSAL_WHY_CHAIN },
  ])("still refuses a records document whose $kind gives no reason", (entry) => {
    expect(exceptionEntriesOfDocument({ document: { version: 1, exceptions: [entry] } })).toMatchObject({ outcome: "failed" });
  });

  it("still judges the why-chain and provenance a file carve-out supplies while file exception why-chains are required", () => {
    expect(
      parseExceptionEntries({
        entries: [
          { place: AT_0, entry: { ...REASONED_CARVE_OUT, whyChain: SHORT_CHAIN } },
          { place: AT_1, entry: IMPORTED_CARVE_OUT },
        ],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: NOTHING_AT_BASE,
      }),
    ).toMatchObject({
      records: [],
      invalid: [
        { place: AT_0, problem: { kind: "why-chain-refused" } },
        { place: AT_1, problem: { kind: "import-unverified" } },
      ],
    });
  });
});

const LEGACY_CARVE_OUT = { ...FILE_CARVE_OUT, whyChain: LEGACY_WHY_CHAIN };

const LEGACY_CLAUSE_WIDE = { ...CLAUSE_WIDE, whyChain: LEGACY_WHY_CHAIN };

const LEGACY_RECORD = {
  kind: "file-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: "audit",
  file: "src/legacy.ts",
  reason: FILE_CARVE_OUT.reason,
  whyChain: LEGACY_WHY_CHAIN,
};

describe("parseExceptionEntries judges a chain without rootCheck and readback by the legacy contract only while base holds it", () => {
  it("accepts a legacy chain whose entry base holds unchanged", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: LEGACY_CARVE_OUT }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({ entriesAtBase: [LEGACY_CARVE_OUT], sourceTextsAtBase: new Map() }),
      }),
    ).toEqual({ records: [LEGACY_RECORD], invalid: [] });
  });

  it("accepts a legacy chain whose entry base holds unchanged at another position", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: LEGACY_CARVE_OUT }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({ entriesAtBase: [LOCATION, LEGACY_CARVE_OUT], sourceTextsAtBase: new Map() }),
      }).invalid,
    ).toEqual([]);
  });

  it("accepts a legacy chain when no base revision was measured, for the run to report as unmeasured", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: LEGACY_CARVE_OUT }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: UNMEASURED_EXCEPTION_BASELINE }),
    ).toEqual({ records: [LEGACY_RECORD], invalid: [] });
  });

  it("refuses a legacy chain on an entry edited since base, naming the causal contract", () => {
    const edited = { ...LEGACY_CARVE_OUT, reason: "legacy class, now partly paid down" };

    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: edited }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({ entriesAtBase: [LEGACY_CARVE_OUT], sourceTextsAtBase: new Map() }),
      }),
    ).toMatchObject({
      records: [],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused", detail: expect.stringContaining("docs/why-chain-contract.md") } }],
    });
  });

  it("refuses a legacy chain whose keys were reordered since base, as an edit", () => {
    const reordered = {
      ...FILE_CARVE_OUT,
      whyChain: { owner: LEGACY_WHY_CHAIN.owner, rootCause: LEGACY_WHY_CHAIN.rootCause, whys: LEGACY_WHY_CHAIN.whys },
    };

    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: reordered }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({ entriesAtBase: [LEGACY_CARVE_OUT], sourceTextsAtBase: new Map() }),
      }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused" } }] });
  });

  it("refuses a legacy chain on a new entry when base holds no exceptions file", () => {
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: LEGACY_CARVE_OUT }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: NOTHING_AT_BASE }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused" } }] });
  });

  it("refuses a legacy chain when the base exceptions file does not parse, since base then holds no entries", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: LEGACY_CARVE_OUT }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({ entriesAtBase: exceptionEntriesOfText({ text: "{ not json" }), sourceTextsAtBase: new Map() }),
      }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused" } }] });
  });

  it("refuses a legacy chain unchanged since base that fails the earlier floor", () => {
    const ownerless = { ...FILE_CARVE_OUT, whyChain: { ...LEGACY_WHY_CHAIN, owner: "" } };

    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: ownerless }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({ entriesAtBase: [ownerless], sourceTextsAtBase: new Map() }),
      }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused" } }] });
  });

  it("judges a clause-wide carve-out's legacy chain against base too", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: LEGACY_CLAUSE_WIDE }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({ entriesAtBase: [LEGACY_CLAUSE_WIDE], sourceTextsAtBase: new Map() }),
      }).invalid,
    ).toEqual([]);
    expect(
      parseExceptionEntries({ entries: [{ place: AT_0, entry: LEGACY_CLAUSE_WIDE }], selection: SELECTION, fileExceptionWhyChains: "required", baseline: NOTHING_AT_BASE }),
    ).toMatchObject({ records: [], invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused" } }] });
  });

  it("refuses a chain that adds only rootCheck, naming readback as its missing partner", () => {
    expect(
      parseExceptionEntries({
        entries: [{ place: AT_0, entry: { ...FILE_CARVE_OUT, whyChain: { ...LEGACY_WHY_CHAIN, rootCheck: CAUSAL_WHY_CHAIN.rootCheck } } }],
        selection: SELECTION,
        fileExceptionWhyChains: "required",
        baseline: baselineHolding({ entriesAtBase: [LEGACY_CARVE_OUT], sourceTextsAtBase: new Map() }),
      }),
    ).toMatchObject({
      records: [],
      invalid: [{ place: { layout: "single-file", file: "discipline-exceptions.json", index: 0 }, problem: { kind: "why-chain-refused", detail: expect.stringContaining("`whyChain.readback` is required beside `rootCheck`") } }],
    });
  });
});

describe("legacyChainsIn reports whether any entry holds a chain without rootCheck and readback", () => {
  it.each([
    { label: "a legacy chain", entries: [LOCATION, LEGACY_CARVE_OUT], presence: "present" },
    { label: "only causal chains and imports", entries: [LOCATION, FILE_CARVE_OUT, CLAUSE_WIDE], presence: "absent" },
    { label: "no entries", entries: [], presence: "absent" },
  ])("reads $label as $presence", ({ entries, presence }) => {
    expect(legacyChainsIn({ entries })).toBe(presence);
  });
});

const CLASS_SYNTAX_ADDRESS = clauseAddressSchema.parse("CD-14#class-syntax");

const AUDIT = mechanismIdSchema.parse("audit");

const IMPORTED_EXCEPTION_RECORD: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLASS_SYNTAX_ADDRESS,
  mechanism: AUDIT,
  file: repoPathSchema.parse("src/legacy.ts"),
  reason: IMPORTED_CARVE_OUT.reason,
  provenance: IMPORTED_CARVE_OUT.provenance,
};

type RecordImportCase = { readonly label: string; readonly record: ExceptionRecord; readonly recordImport: ImportEvidence };

const RECORD_IMPORT_CASES: readonly RecordImportCase[] = [
  { label: "an imported file carve-out", record: IMPORTED_EXCEPTION_RECORD, recordImport: { imported: "yes", source: IMPORTED_CARVE_OUT.provenance.source } },
  { label: "a chained record that also gives provenance", record: { ...IMPORTED_EXCEPTION_RECORD, whyChain: CAUSAL_WHY_CHAIN }, recordImport: { imported: "no" } },
  {
    label: "a reason-only record",
    record: { kind: "authorised-location", clause: CLASS_SYNTAX_ADDRESS, mechanism: AUDIT, file: repoPathSchema.parse("src/factory.ts"), reason: REASONED_LOCATION.reason },
    recordImport: { imported: "no" },
  },
  {
    label: "a clause-wide carve-out",
    record: { kind: "clause-wide-carve-out", clause: CLASS_SYNTAX_ADDRESS, mechanism: AUDIT, reason: CLAUSE_WIDE.reason, whyChain: CAUSAL_WHY_CHAIN },
    recordImport: { imported: "no" },
  },
];

describe("recordImportOf names the provenance source of an imported record, and of no other", () => {
  it.each(RECORD_IMPORT_CASES)("reads $label", ({ record, recordImport }) => {
    expect(recordImportOf({ record })).toEqual(recordImport);
  });
});
