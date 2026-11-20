import { describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../tests/causal-why-chain.ts";
import type { Finding, GovernedRun } from "../governance/governance.ts";
import type { NativeException } from "../mechanism-port/runner-result-schema.ts";
import type { Check, Recipe, RecordKind, Symptom, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { TouchedSet } from "../touched-set/touched-set.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { answerFindings, type RaisedFinding } from "./answering.ts";
import type { PlacedRecord } from "./hone-record.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const AUTHORISED_LOCATION_KIND: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

const DEBT_KIND: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const ADAPTER_PER_OUTSIDE_PARTY: Recipe = {
  name: "adapter-per-outside-party",
  title: "Adapter per outside party",
  standing: "accepted",
  reason: { text: "One adapter holds each outside party.", standing: "accepted" },
};

const symptomOf = (request: { readonly name: string; readonly recipes: readonly Recipe[] }): Symptom => ({
  name: request.name,
  title: request.name,
  seen: "Seen.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: request.recipes,
  correctUses: [],
});

const AUTHORED_CLASS = symptomOf({ name: "authored-class-or-this", recipes: [] });

const LOOP_KEYWORD = symptomOf({ name: "loop-keyword", recipes: [] });

const OUTSIDE_IMPORT = symptomOf({ name: "outside-import-past-a-boundary", recipes: [ADAPTER_PER_OUTSIDE_PARTY] });

const NO_CLASS = clauseAddressSchema.parse("CD-14#no-class-syntax");

const NO_FOR_OF = clauseAddressSchema.parse("CD-15#no-for-of");

const IMPORT_BOUNDARIES = clauseAddressSchema.parse("CD-19#import-boundaries");

const UNCATALOGUED = clauseAddressSchema.parse("CD-99#nowhere");

const checkOf = (request: { readonly name: string; readonly symptom: Symptom; readonly clause: Check["clause"] }): Check => ({
  ...request,
  engines: [{ name: "walker", mechanism: AUDIT }],
  forms: [],
});

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [ADAPTER_PER_OUTSIDE_PARTY],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
  engines: [{ name: "walker", mechanism: AUDIT }],
  symptoms: [AUTHORED_CLASS, LOOP_KEYWORD, OUTSIDE_IMPORT],
  clauses: [
    { clause: NO_CLASS, sight: { kind: "one-symptom", symptom: AUTHORED_CLASS } },
    { clause: NO_FOR_OF, sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
    { clause: IMPORT_BOUNDARIES, sight: { kind: "one-symptom", symptom: OUTSIDE_IMPORT } },
  ],
  checks: [
    checkOf({ name: "class-syntax", symptom: AUTHORED_CLASS, clause: NO_CLASS }),
    checkOf({ name: "for-of", symptom: LOOP_KEYWORD, clause: NO_FOR_OF }),
    checkOf({ name: "import-or-require", symptom: OUTSIDE_IMPORT, clause: IMPORT_BOUNDARIES }),
  ],
  namedBans: [{ outsideDependency: "lodash" }],
};

const FILE_A = repoPathSchema.parse("src/a.ts");

const FILE_B = repoPathSchema.parse("src/b.ts");

const IDS_ADAPTER = repoPathSchema.parse("src/adapters/ids/make-id.ts");

const PACKAGE_JSON = repoPathSchema.parse("package.json");

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/authored-class-or-this.json");

const AUTHORISED_FILE = repoPathSchema.parse("hone-records/authorised-locations/authored-class-or-this.json");

const BOUNDARIES_FILE = repoPathSchema.parse("hone-records/boundaries.json");

const DEVIATIONS_FILE = repoPathSchema.parse("hone-records/deviations/adapter-per-outside-party.json");

const DEPENDENCIES_FILE = repoPathSchema.parse("hone-records/dependencies.json");

const NO_CLASS_IN_A: Finding = { clause: NO_CLASS, file: FILE_A, anchor: { line: 3, column: 5 }, snippet: "class A {}", mechanism: AUDIT };

const NO_CLASS_IN_B: Finding = { clause: NO_CLASS, file: FILE_B, anchor: { line: 8, column: 1 }, snippet: "class B {}", mechanism: AUDIT };

const FOR_OF_IN_A: Finding = { clause: NO_FOR_OF, file: FILE_A, anchor: { line: 9, column: 2 }, snippet: "a loop over the orders", mechanism: AUDIT };

const UNCATALOGUED_IN_A: Finding = { clause: UNCATALOGUED, file: FILE_A, anchor: { line: 1, column: 0 }, snippet: "nowhere", mechanism: AUDIT };

const UUID_IMPORT_IN_IDS: Finding = {
  clause: IMPORT_BOUNDARIES,
  file: IDS_ADAPTER,
  anchor: { line: 1, column: 0 },
  snippet: "banned third-party import: uuid — use its recorded wrapping boundary",
  mechanism: AUDIT,
};

const LODASH_IMPORT_IN_A: Finding = {
  clause: IMPORT_BOUNDARIES,
  file: FILE_A,
  anchor: { line: 1, column: 0 },
  snippet: "banned third-party import: lodash — use its recorded wrapping boundary",
  mechanism: AUDIT,
};

const notAnImport = (finding: Finding): RaisedFinding => ({ finding, raisedBy: { kind: "not-an-import" } });

const DEBT_ON_CLASS_IN_A: PlacedRecord = {
  place: { file: DEBT_FILE, index: 0 },
  record: { kind: "debt", symptom: AUTHORED_CLASS, file: FILE_A, holding: { held: "stated" } },
};

const DEBT_ON_CLASS_IN_B: PlacedRecord = {
  place: { file: DEBT_FILE, index: 1 },
  record: { kind: "debt", symptom: AUTHORED_CLASS, file: FILE_B, holding: { held: "stated" } },
};

const LOCATED_CLASS_IN_A: PlacedRecord = {
  place: { file: AUTHORISED_FILE, index: 0 },
  record: {
    kind: "authorised-location",
    symptom: AUTHORED_CLASS,
    file: FILE_A,
    holding: {
      held: "stated",
      owing: { matches: "not-the-catalogue", note: { kind: "unknown-case", case: "needs-it-here", owes: "declared-not-asserted" } },
      whyChain: CAUSAL_WHY_CHAIN,
    },
  },
};

const CARRIED_CLASS_IN_A: PlacedRecord = {
  place: { file: AUTHORISED_FILE, index: 1 },
  record: {
    kind: "authorised-location",
    symptom: AUTHORED_CLASS,
    file: FILE_A,
    holding: { held: "carried", entry: { reason: "The parser's class is wrapped here." }, lacks: ["case", "owes", "whyChain"], standing: "unjudged" },
  },
};

const LOCATED_UUID_IN_IDS: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/authorised-locations/outside-import-past-a-boundary.json"), index: 0 },
  record: {
    kind: "authorised-location",
    symptom: OUTSIDE_IMPORT,
    file: IDS_ADAPTER,
    holding: { held: "carried", entry: { reason: "uuid stays here." }, lacks: ["case", "owes", "whyChain"], standing: "established" },
  },
};

const IDS_BOUNDARY: PlacedRecord = {
  place: { file: BOUNDARIES_FILE, index: 0 },
  record: {
    kind: "boundary-record",
    module: repoPathSchema.parse("src/adapters/ids"),
    outsideParty: { kind: "package", specifier: "uuid", dependency: "uuid" },
    holding: { held: "stated", ports: ["IdSource"] },
  },
};

const ADAPTER_DEVIATION_IN_A: PlacedRecord = {
  place: { file: DEVIATIONS_FILE, index: 0 },
  record: {
    kind: "deviation",
    recipe: ADAPTER_PER_OUTSIDE_PARTY,
    file: FILE_A,
    reasonFails: "The import is used once, in a script.",
    evidence: "src/a.ts:1.",
    ruleHolds: "Nothing past the script sees it.",
  },
};

const ZOD_DEPENDENCY: PlacedRecord = {
  place: { file: DEPENDENCIES_FILE, index: 0 },
  record: { kind: "dependency-record", dependency: "zod", nativeWay: "hand-written parsing", whyNotEnough: "Each adapter would repeat its checks." },
};

const NOTHING_TOUCHED: TouchedSet = { measured: "yes", paths: new Set() };

const FILE_A_TOUCHED: TouchedSet = { measured: "yes", paths: new Set([FILE_A]) };

const UNMEASURED: TouchedSet = { measured: "no", base: { state: "not-given" } };

const ELSEWHERE: TouchedSet = { measured: "elsewhere" };

const DISABLE_IN_A: NativeException = { kind: "inline-disable", clause: NO_CLASS, file: FILE_A, line: 4, text: "// eslint-disable-next-line", reach: "one-clause" };

const SCRIPT_RULE_OFF: NativeException = {
  kind: "command-line-option",
  clause: NO_CLASS,
  location: PACKAGE_JSON,
  script: "lint",
  option: "--rule no-class:off",
  cause: { kind: "weakens-run" },
};

const inlineRun = (request: { readonly nativeExceptions: readonly NativeException[] }): GovernedRun => ({
  mechanism: AUDIT,
  nativeExceptions: request.nativeExceptions,
  coverableKinds: ["inline-disable", "command-line-option"],
});

const NOTHING_ANSWERED = { findings: [], answered: [], stale: [], forfeited: [], doublyHeld: [], unrecorded: [] };

describe("answerFindings with no records", () => {
  it("keeps every finding and lists nothing else", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [], findings: [notAnImport(NO_CLASS_IN_A)], touched: NOTHING_TOUCHED, runs: [] })).toEqual({
      ...NOTHING_ANSWERED,
      findings: [NO_CLASS_IN_A],
    });
  });
});

describe("answerFindings, answer", () => {
  it.each([{ placed: DEBT_ON_CLASS_IN_A }, { placed: LOCATED_CLASS_IN_A }, { placed: CARRIED_CLASS_IN_A }])(
    "answers a finding whose symptom and file the $placed.record.kind at $placed.place.file names, and leaves it out of findings",
    ({ placed }) => {
      expect(answerFindings({ catalogue: CATALOGUE, records: [placed], findings: [notAnImport(NO_CLASS_IN_A)], touched: NOTHING_TOUCHED, runs: [] })).toEqual({
        ...NOTHING_ANSWERED,
        answered: [{ finding: NO_CLASS_IN_A, by: [placed] }],
      });
    },
  );

  it("answers by a deviation from a recipe of the finding's symptom at its file", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [ADAPTER_DEVIATION_IN_A],
        findings: [{ finding: { ...UUID_IMPORT_IN_IDS, file: FILE_A }, raisedBy: { kind: "import", specifier: "uuid" } }],
        touched: NOTHING_TOUCHED,
        runs: [],
      }),
    ).toEqual({ ...NOTHING_ANSWERED, answered: [{ finding: { ...UUID_IMPORT_IN_IDS, file: FILE_A }, by: [ADAPTER_DEVIATION_IN_A] }] });
  });

  it("does not answer a finding raised by a banned import by a deviation, and lists the deviation as stale", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [ADAPTER_DEVIATION_IN_A],
        findings: [{ finding: LODASH_IMPORT_IN_A, raisedBy: { kind: "import", specifier: "lodash/fp" } }],
        touched: NOTHING_TOUCHED,
        runs: [],
      }),
    ).toEqual({ ...NOTHING_ANSWERED, findings: [LODASH_IMPORT_IN_A], stale: [ADAPTER_DEVIATION_IN_A] });
  });

  it("answers by a boundary record over a finding in a file inside its module", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [IDS_BOUNDARY], findings: [notAnImport(UUID_IMPORT_IN_IDS)], touched: NOTHING_TOUCHED, runs: [] }),
    ).toEqual({ ...NOTHING_ANSWERED, answered: [{ finding: UUID_IMPORT_IN_IDS, by: [IDS_BOUNDARY] }] });
  });

  it("credits every record that holds the finding, in the records' order", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [LOCATED_UUID_IN_IDS, IDS_BOUNDARY],
        findings: [notAnImport(UUID_IMPORT_IN_IDS)],
        touched: NOTHING_TOUCHED,
        runs: [],
      }),
    ).toEqual({ ...NOTHING_ANSWERED, answered: [{ finding: UUID_IMPORT_IN_IDS, by: [LOCATED_UUID_IN_IDS, IDS_BOUNDARY] }] });
  });

  it("does not answer a finding in a file the record does not name", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [notAnImport(NO_CLASS_IN_B)], touched: NOTHING_TOUCHED, runs: [] })).toEqual({
      ...NOTHING_ANSWERED,
      findings: [NO_CLASS_IN_B],
      stale: [DEBT_ON_CLASS_IN_A],
    });
  });

  it("does not answer a finding of a symptom the record does not name", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [notAnImport(FOR_OF_IN_A)], touched: NOTHING_TOUCHED, runs: [] })).toEqual({
      ...NOTHING_ANSWERED,
      findings: [FOR_OF_IN_A],
      stale: [DEBT_ON_CLASS_IN_A],
    });
  });

  it("does not answer a finding whose check the catalogue names no symptom for", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [notAnImport(UNCATALOGUED_IN_A)], touched: NOTHING_TOUCHED, runs: [] }),
    ).toEqual({ ...NOTHING_ANSWERED, findings: [UNCATALOGUED_IN_A], stale: [DEBT_ON_CLASS_IN_A] });
  });
});

describe("answerFindings, forfeit", () => {
  it("forfeits debt whose file was touched, and it answers nothing", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [notAnImport(NO_CLASS_IN_A)], touched: FILE_A_TOUCHED, runs: [] })).toEqual({
      ...NOTHING_ANSWERED,
      findings: [NO_CLASS_IN_A],
      forfeited: [DEBT_ON_CLASS_IN_A],
    });
  });

  it("does not forfeit an authorised location whose file was touched", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [LOCATED_CLASS_IN_A], findings: [notAnImport(NO_CLASS_IN_A)], touched: FILE_A_TOUCHED, runs: [] })).toEqual({
      ...NOTHING_ANSWERED,
      answered: [{ finding: NO_CLASS_IN_A, by: [LOCATED_CLASS_IN_A] }],
    });
  });

  it.each([{ touched: UNMEASURED }, { touched: ELSEWHERE }])(
    "forfeits nothing when the touched set is measured $touched.measured, so the debt still answers",
    ({ touched }) => {
      expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [notAnImport(NO_CLASS_IN_A)], touched, runs: [] })).toEqual({
        ...NOTHING_ANSWERED,
        answered: [{ finding: NO_CLASS_IN_A, by: [DEBT_ON_CLASS_IN_A] }],
      });
    },
  );
});

describe("answerFindings, doubly held", () => {
  it("lists debt on a symptom and file an authorised location also holds, and only the authorised location answers", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [LOCATED_CLASS_IN_A, DEBT_ON_CLASS_IN_A],
        findings: [notAnImport(NO_CLASS_IN_A)],
        touched: NOTHING_TOUCHED,
        runs: [],
      }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      answered: [{ finding: NO_CLASS_IN_A, by: [LOCATED_CLASS_IN_A] }],
      doublyHeld: [{ debt: DEBT_ON_CLASS_IN_A, alsoHeldBy: [LOCATED_CLASS_IN_A] }],
    });
  });

  it("lists a doubly-held symptom and file that no finding hits, and lists neither record as stale", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A, LOCATED_CLASS_IN_A], findings: [], touched: NOTHING_TOUCHED, runs: [] })).toEqual({
      ...NOTHING_ANSWERED,
      doublyHeld: [{ debt: DEBT_ON_CLASS_IN_A, alsoHeldBy: [LOCATED_CLASS_IN_A] }],
    });
  });

  it("lists debt that a boundary record also holds in its module", () => {
    const debtOnUuidInIds: PlacedRecord = {
      place: { file: repoPathSchema.parse("hone-records/debt/outside-import-past-a-boundary.json"), index: 0 },
      record: { kind: "debt", symptom: OUTSIDE_IMPORT, file: IDS_ADAPTER, holding: { held: "stated" } },
    };
    expect(answerFindings({ catalogue: CATALOGUE, records: [debtOnUuidInIds, IDS_BOUNDARY], findings: [], touched: NOTHING_TOUCHED, runs: [] })).toEqual({
      ...NOTHING_ANSWERED,
      doublyHeld: [{ debt: debtOnUuidInIds, alsoHeldBy: [IDS_BOUNDARY] }],
    });
  });

  it("does not list a pair whose debt was forfeited, and the authorised location answers", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A, LOCATED_CLASS_IN_A],
        findings: [notAnImport(NO_CLASS_IN_A)],
        touched: FILE_A_TOUCHED,
        runs: [],
      }),
    ).toEqual({ ...NOTHING_ANSWERED, answered: [{ finding: NO_CLASS_IN_A, by: [LOCATED_CLASS_IN_A] }], forfeited: [DEBT_ON_CLASS_IN_A] });
  });
});

describe("answerFindings, stale", () => {
  it("lists a record in force that answers no finding", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [LOCATED_CLASS_IN_A], findings: [], touched: NOTHING_TOUCHED, runs: [] })).toEqual({
      ...NOTHING_ANSWERED,
      stale: [LOCATED_CLASS_IN_A],
    });
  });

  it("does not list a forfeited record as stale", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [], touched: FILE_A_TOUCHED, runs: [] })).toEqual({
      ...NOTHING_ANSWERED,
      forfeited: [DEBT_ON_CLASS_IN_A],
    });
  });

  it("does not list a dependency record as stale, since no check asks for one yet", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [ZOD_DEPENDENCY], findings: [], touched: NOTHING_TOUCHED, runs: [] })).toEqual(NOTHING_ANSWERED);
  });

  it("keeps stale records in the records' order", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_B, LOCATED_UUID_IN_IDS], findings: [], touched: NOTHING_TOUCHED, runs: [] })).toEqual({
      ...NOTHING_ANSWERED,
      stale: [DEBT_ON_CLASS_IN_B, LOCATED_UUID_IN_IDS],
    });
  });
});

describe("answerFindings, natives held", () => {
  it("does not list an inline disable that debt on its check's symptom at its file holds, and the debt is not stale", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [], touched: NOTHING_TOUCHED, runs: [inlineRun({ nativeExceptions: [DISABLE_IN_A] })] }),
    ).toEqual(NOTHING_ANSWERED);
  });

  it("does not list an inline disable that a doubly-held pair holds", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A, LOCATED_CLASS_IN_A],
        findings: [],
        touched: NOTHING_TOUCHED,
        runs: [inlineRun({ nativeExceptions: [DISABLE_IN_A] })],
      }),
    ).toEqual({ ...NOTHING_ANSWERED, doublyHeld: [{ debt: DEBT_ON_CLASS_IN_A, alsoHeldBy: [LOCATED_CLASS_IN_A] }] });
  });

  it("lists, attributed to its engine, an inline disable no record holds", () => {
    expect(answerFindings({ catalogue: CATALOGUE, records: [], findings: [], touched: NOTHING_TOUCHED, runs: [inlineRun({ nativeExceptions: [DISABLE_IN_A] })] })).toEqual({
      ...NOTHING_ANSWERED,
      unrecorded: [{ ...DISABLE_IN_A, mechanism: AUDIT }],
    });
  });

  it("lists an inline disable whose record names another file", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_B], findings: [], touched: NOTHING_TOUCHED, runs: [inlineRun({ nativeExceptions: [DISABLE_IN_A] })] }),
    ).toEqual({ ...NOTHING_ANSWERED, stale: [DEBT_ON_CLASS_IN_B], unrecorded: [{ ...DISABLE_IN_A, mechanism: AUDIT }] });
  });

  it("lists a native exception of a kind its run does not make coverable, and the record matching it is stale", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A],
        findings: [],
        touched: NOTHING_TOUCHED,
        runs: [{ mechanism: AUDIT, nativeExceptions: [DISABLE_IN_A], coverableKinds: [] }],
      }),
    ).toEqual({ ...NOTHING_ANSWERED, stale: [DEBT_ON_CLASS_IN_A], unrecorded: [{ ...DISABLE_IN_A, mechanism: AUDIT }] });
  });

  it("lists an inline disable that only forfeited debt matches, since forfeited debt no longer holds it", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [DEBT_ON_CLASS_IN_A], findings: [], touched: FILE_A_TOUCHED, runs: [inlineRun({ nativeExceptions: [DISABLE_IN_A] })] }),
    ).toEqual({ ...NOTHING_ANSWERED, forfeited: [DEBT_ON_CLASS_IN_A], unrecorded: [{ ...DISABLE_IN_A, mechanism: AUDIT }] });
  });

  it("lists a command-line option even where its run makes the kind coverable, since no record names a file it sits in", () => {
    expect(
      answerFindings({ catalogue: CATALOGUE, records: [], findings: [], touched: NOTHING_TOUCHED, runs: [inlineRun({ nativeExceptions: [SCRIPT_RULE_OFF] })] }),
    ).toEqual({ ...NOTHING_ANSWERED, unrecorded: [{ ...SCRIPT_RULE_OFF, mechanism: AUDIT }] });
  });

  it("lists an inline disable from an engine that runs no check of its clause, though a record on that check's symptom names its file", () => {
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [DEBT_ON_CLASS_IN_A],
        findings: [],
        touched: NOTHING_TOUCHED,
        runs: [{ mechanism: ESLINT, nativeExceptions: [DISABLE_IN_A], coverableKinds: ["inline-disable"] }],
      }),
    ).toEqual({ ...NOTHING_ANSWERED, stale: [DEBT_ON_CLASS_IN_A], unrecorded: [{ ...DISABLE_IN_A, mechanism: ESLINT }] });
  });

  it("keeps unrecorded native exceptions in the runs' order, then each run's own order", () => {
    const disableInB: NativeException = { ...DISABLE_IN_A, file: FILE_B };
    expect(
      answerFindings({
        catalogue: CATALOGUE,
        records: [],
        findings: [],
        touched: NOTHING_TOUCHED,
        runs: [
          { mechanism: ESLINT, nativeExceptions: [disableInB], coverableKinds: [] },
          inlineRun({ nativeExceptions: [DISABLE_IN_A, SCRIPT_RULE_OFF] }),
        ],
      }),
    ).toEqual({
      ...NOTHING_ANSWERED,
      unrecorded: [
        { ...disableInB, mechanism: ESLINT },
        { ...DISABLE_IN_A, mechanism: AUDIT },
        { ...SCRIPT_RULE_OFF, mechanism: AUDIT },
      ],
    });
  });
});
