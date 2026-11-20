import { describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../tests/causal-why-chain.ts";
import type { Case, Recipe, RecordKind, Symptom, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { BoundaryRecord, HoneRecord, RuntimeFacility } from "./hone-record.ts";
import { holdsAt, overlapsAt, type PartyReport } from "./record-reach.ts";

const AUTHORISED_LOCATION_KIND: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

const DEBT_KIND: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const ADAPTER_PER_OUTSIDE_PARTY: Recipe = {
  name: "adapter-per-outside-party",
  title: "Adapter per outside party",
  standing: "accepted",
  reason: { text: "One adapter holds each outside party.", standing: "accepted" },
};

const STUB_WITH_VIFN: Recipe = { name: "stub-with-vifn", title: "Stub with vi.fn", standing: "accepted", reason: { text: "A stub states its answer.", standing: "accepted" } };

const symptomOf = (request: { readonly name: string; readonly recipes: readonly Recipe[] }): Symptom => ({
  name: request.name,
  title: request.name,
  seen: "Seen.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: request.recipes,
  correctUses: [],
});

const DATE_USED_DIRECTLY = symptomOf({ name: "date-used-directly", recipes: [] });

const AMBIENT_RANDOMNESS = symptomOf({ name: "ambient-randomness", recipes: [] });

const PROCESS_GLOBAL = symptomOf({ name: "process-global-used-in-place", recipes: [] });

const TEXT_PAST_ITS_READER = symptomOf({ name: "text-past-its-reader", recipes: [ADAPTER_PER_OUTSIDE_PARTY] });

const OUTSIDE_IMPORT = symptomOf({ name: "outside-import-past-a-boundary", recipes: [ADAPTER_PER_OUTSIDE_PARTY] });

const LIBRARY_CLASS = symptomOf({ name: "library-class-built-in-place", recipes: [ADAPTER_PER_OUTSIDE_PARTY] });

const OUTSIDE_TYPE = symptomOf({ name: "outside-type-in-a-signature", recipes: [ADAPTER_PER_OUTSIDE_PARTY] });

const CLAIMED_TYPE = symptomOf({ name: "claimed-type", recipes: [] });

const DOUBLE_WITH_A_BODY = symptomOf({ name: "double-with-a-body", recipes: [STUB_WITH_VIFN] });

const GIVES_A_VALUE_ITS_TYPE: Case = { name: "gives-a-value-its-type", title: "Gives a value its type", standing: "accepted", owes: [] };

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [GIVES_A_VALUE_ITS_TYPE],
  recipes: [ADAPTER_PER_OUTSIDE_PARTY, STUB_WITH_VIFN],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
  engines: [],
  symptoms: [DATE_USED_DIRECTLY, AMBIENT_RANDOMNESS, PROCESS_GLOBAL, TEXT_PAST_ITS_READER, OUTSIDE_IMPORT, LIBRARY_CLASS, OUTSIDE_TYPE, CLAIMED_TYPE, DOUBLE_WITH_A_BODY],
  clauses: [],
  checks: [],
  namedBans: [{ outsideDependency: "lodash" }],
};

const ADAPTER = repoPathSchema.parse("src/adapters/stripe-webhook.ts");

const OTHER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const NOT_REPORTED: PartyReport = { reported: "not-reported" };

const reportedAs = (specifier: string): PartyReport => ({ reported: "specifier", specifier });

const RUNTIME_REACH: readonly { readonly facility: RuntimeFacility; readonly symptom: Symptom }[] = [
  { facility: "clock", symptom: DATE_USED_DIRECTLY },
  { facility: "random", symptom: AMBIENT_RANDOMNESS },
  { facility: "process", symptom: PROCESS_GLOBAL },
  { facility: "json", symptom: TEXT_PAST_ITS_READER },
];

const DEBT: HoneRecord = { kind: "debt", symptom: CLAIMED_TYPE, file: ADAPTER, holding: { held: "stated" } };

const AUTHORISED_LOCATION: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  file: ADAPTER,
  holding: { held: "carried", entry: { reason: "Kept." }, lacks: ["case", "owes", "whyChain"], standing: "unjudged" },
};

const AUTHORISED_LOCATION_OFF_THE_CATALOGUE: HoneRecord = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  file: ADAPTER,
  holding: {
    held: "stated",
    owing: { matches: "not-the-catalogue", note: { kind: "unknown-case", case: "needs-it-here", owes: "declared-not-asserted" } },
    whyChain: CAUSAL_WHY_CHAIN,
  },
};

const IMPORT_DEBT: HoneRecord = { kind: "debt", symptom: OUTSIDE_IMPORT, file: ADAPTER, holding: { held: "stated" } };

const IMPORT_LOCATION: HoneRecord = { ...AUTHORISED_LOCATION, symptom: OUTSIDE_IMPORT };

const IMPORT_LOCATION_OFF_THE_CATALOGUE: HoneRecord = { ...AUTHORISED_LOCATION_OFF_THE_CATALOGUE, symptom: OUTSIDE_IMPORT };

const DEVIATION: HoneRecord = {
  kind: "deviation",
  recipe: STUB_WITH_VIFN,
  file: ADAPTER,
  reasonFails: "The answers depend on earlier calls.",
  evidence: "Line 40.",
  ruleHolds: "Each answer is written out.",
};

const ADAPTER_DEVIATION: HoneRecord = { ...DEVIATION, recipe: ADAPTER_PER_OUTSIDE_PARTY };

const boundaryOn = (request: { readonly module: string; readonly outsideParty: BoundaryRecord["outsideParty"] }): HoneRecord => ({
  kind: "boundary-record",
  module: repoPathSchema.parse(request.module),
  outsideParty: request.outsideParty,
  holding: { held: "stated", ports: ["Port"] },
});

const UUID_BOUNDARY = boundaryOn({ module: "src/adapters/ids.ts", outsideParty: { kind: "package", specifier: "uuid", dependency: "uuid" } });

const FILES_BOUNDARY = boundaryOn({ module: "src/adapters/files", outsideParty: { kind: "scheme-module", specifier: "node:fs" } });

const IDS_FILE = repoPathSchema.parse("src/adapters/ids.ts");

const READ_TEXT_FILE = repoPathSchema.parse("src/adapters/files/read-text.ts");

describe("holdsAt, debt and authorised locations", () => {
  it.each([{ record: DEBT }, { record: AUTHORISED_LOCATION }, { record: AUTHORISED_LOCATION_OFF_THE_CATALOGUE }])(
    "holds a $record.kind on its symptom at its exact file, whatever it claims beyond that",
    ({ record }) => {
      expect(holdsAt({ record, site: { symptom: CLAIMED_TYPE, file: ADAPTER, party: NOT_REPORTED }, catalogue: CATALOGUE })).toBe("holds");
    },
  );

  it.each([{ record: IMPORT_DEBT }, { record: IMPORT_LOCATION }, { record: IMPORT_LOCATION_OFF_THE_CATALOGUE }])(
    "holds a $record.kind over a finding raised by an import of a named ban, since a ban never refuses debt or an authorised location",
    ({ record }) => {
      expect(holdsAt({ record, site: { symptom: OUTSIDE_IMPORT, file: ADAPTER, party: reportedAs("lodash") }, catalogue: CATALOGUE })).toBe("holds");
    },
  );

  it.each([{ record: DEBT }, { record: AUTHORISED_LOCATION }])("does not hold a $record.kind on another symptom at its file", ({ record }) => {
    expect(holdsAt({ record, site: { symptom: DOUBLE_WITH_A_BODY, file: ADAPTER, party: NOT_REPORTED }, catalogue: CATALOGUE })).toBe("does-not-hold");
  });

  it.each([
    { record: DEBT, file: OTHER_FILE },
    { record: AUTHORISED_LOCATION, file: OTHER_FILE },
    { record: DEBT, file: repoPathSchema.parse("src/adapters/stripe-webhook.ts.bak") },
    { record: AUTHORISED_LOCATION, file: repoPathSchema.parse("src/adapters/stripe-webhook.ts/inner.ts") },
  ])("does not hold a $record.kind at $file, since its file never widens to a folder or a prefix", ({ record, file }) => {
    expect(holdsAt({ record, site: { symptom: CLAIMED_TYPE, file, party: NOT_REPORTED }, catalogue: CATALOGUE })).toBe("does-not-hold");
  });
});

describe("holdsAt, deviations", () => {
  it("holds a deviation at its file on a symptom whose recipes include its recipe", () => {
    expect(holdsAt({ record: DEVIATION, site: { symptom: DOUBLE_WITH_A_BODY, file: ADAPTER, party: NOT_REPORTED }, catalogue: CATALOGUE })).toBe("holds");
  });

  it("does not hold a deviation on a symptom whose recipes do not include its recipe", () => {
    expect(holdsAt({ record: DEVIATION, site: { symptom: CLAIMED_TYPE, file: ADAPTER, party: NOT_REPORTED }, catalogue: CATALOGUE })).toBe("does-not-hold");
  });

  it("does not hold a deviation at another file", () => {
    expect(holdsAt({ record: DEVIATION, site: { symptom: DOUBLE_WITH_A_BODY, file: OTHER_FILE, party: NOT_REPORTED }, catalogue: CATALOGUE })).toBe("does-not-hold");
  });

  it("holds a deviation over a finding raised by an import of a dependency that is not banned", () => {
    expect(holdsAt({ record: ADAPTER_DEVIATION, site: { symptom: OUTSIDE_IMPORT, file: ADAPTER, party: reportedAs("uuid") }, catalogue: CATALOGUE })).toBe("holds");
  });

  it.each([{ specifier: "lodash" }, { specifier: "lodash/fp" }, { specifier: "npm:lodash@4" }, { specifier: "LODASH" }])(
    "does not hold a deviation over a finding raised by an import of $specifier, since no deviation makes a named ban correct",
    ({ specifier }) => {
      expect(holdsAt({ record: ADAPTER_DEVIATION, site: { symptom: OUTSIDE_IMPORT, file: ADAPTER, party: reportedAs(specifier) }, catalogue: CATALOGUE })).toBe(
        "does-not-hold",
      );
    },
  );

  it.each([{ symptom: OUTSIDE_IMPORT }, { symptom: LIBRARY_CLASS }, { symptom: OUTSIDE_TYPE }])(
    "does not hold a deviation over $symptom.name when the finding does not report its outside party, since it may be a named ban",
    ({ symptom }) => {
      expect(holdsAt({ record: ADAPTER_DEVIATION, site: { symptom, file: ADAPTER, party: NOT_REPORTED }, catalogue: CATALOGUE })).toBe("does-not-hold");
    },
  );
});

describe("holdsAt, boundary records", () => {
  it.each([
    { symptom: OUTSIDE_IMPORT, specifier: "uuid" },
    { symptom: LIBRARY_CLASS, specifier: "uuid" },
    { symptom: OUTSIDE_TYPE, specifier: "uuid/v4" },
  ])("holds a boundary record on a package over $symptom.name of $specifier in its module", ({ symptom, specifier }) => {
    expect(holdsAt({ record: UUID_BOUNDARY, site: { symptom, file: IDS_FILE, party: reportedAs(specifier) }, catalogue: CATALOGUE })).toBe("holds");
  });

  it("holds a boundary record on a module its scheme names over an import of it in a file inside its module folder", () => {
    expect(holdsAt({ record: FILES_BOUNDARY, site: { symptom: OUTSIDE_IMPORT, file: READ_TEXT_FILE, party: reportedAs("node:fs") }, catalogue: CATALOGUE })).toBe("holds");
  });

  it.each([
    { record: UUID_BOUNDARY, file: IDS_FILE, specifier: "nanoid" },
    { record: FILES_BOUNDARY, file: READ_TEXT_FILE, specifier: "lodash" },
    { record: FILES_BOUNDARY, file: READ_TEXT_FILE, specifier: "node:path" },
  ])("does not hold a boundary record over an import of $specifier, another outside party, in its module", ({ record, file, specifier }) => {
    expect(holdsAt({ record, site: { symptom: OUTSIDE_IMPORT, file, party: reportedAs(specifier) }, catalogue: CATALOGUE })).toBe("does-not-hold");
  });

  it.each([{ record: UUID_BOUNDARY, file: IDS_FILE }, { record: FILES_BOUNDARY, file: READ_TEXT_FILE }])(
    "does not hold a boundary record on $record.outsideParty.specifier over an import whose outside party is not reported",
    ({ record, file }) => {
      expect(holdsAt({ record, site: { symptom: OUTSIDE_IMPORT, file, party: NOT_REPORTED }, catalogue: CATALOGUE })).toBe("does-not-hold");
    },
  );

  it("does not hold a boundary record in a file that only shares its module's name as a prefix", () => {
    expect(
      holdsAt({ record: FILES_BOUNDARY, site: { symptom: OUTSIDE_IMPORT, file: repoPathSchema.parse("src/adapters/files-old.ts"), party: reportedAs("node:fs") }, catalogue: CATALOGUE }),
    ).toBe("does-not-hold");
  });

  it.each(RUNTIME_REACH)("holds a boundary record on runtime:$facility over $symptom.name in its module", ({ facility, symptom }) => {
    expect(
      holdsAt({
        record: boundaryOn({ module: "src/adapters/world.ts", outsideParty: { kind: "runtime", facility } }),
        site: { symptom, file: repoPathSchema.parse("src/adapters/world.ts"), party: NOT_REPORTED },
        catalogue: CATALOGUE,
      }),
    ).toBe("holds");
  });

  it.each(RUNTIME_REACH)("does not hold a boundary record on runtime:$facility over an outside import", ({ facility }) => {
    expect(
      holdsAt({
        record: boundaryOn({ module: "src/adapters/world.ts", outsideParty: { kind: "runtime", facility } }),
        site: { symptom: OUTSIDE_IMPORT, file: repoPathSchema.parse("src/adapters/world.ts"), party: reportedAs("uuid") },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it("does not hold a boundary record on runtime:json over a symptom another facility reaches", () => {
    expect(
      holdsAt({
        record: boundaryOn({ module: "src/adapters/json.ts", outsideParty: { kind: "runtime", facility: "json" } }),
        site: { symptom: DATE_USED_DIRECTLY, file: repoPathSchema.parse("src/adapters/json.ts"), party: NOT_REPORTED },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it("does not hold a boundary record on a package over a symptom outside an outside party's reach", () => {
    expect(
      holdsAt({
        record: boundaryOn({ module: "src/adapters/stripe-webhook.ts", outsideParty: { kind: "package", specifier: "stripe", dependency: "stripe" } }),
        site: { symptom: CLAIMED_TYPE, file: ADAPTER, party: reportedAs("stripe") },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it("holds a boundary record on a named ban, since a ban refuses only a dependency record or a deviation", () => {
    expect(
      holdsAt({
        record: boundaryOn({ module: "src/adapters/collections.ts", outsideParty: { kind: "package", specifier: "lodash", dependency: "lodash" } }),
        site: { symptom: OUTSIDE_IMPORT, file: repoPathSchema.parse("src/adapters/collections.ts"), party: reportedAs("lodash/fp") },
        catalogue: CATALOGUE,
      }),
    ).toBe("holds");
  });
});

describe("holdsAt, dependency records", () => {
  it("holds nothing, since no check asks for a dependency record yet", () => {
    expect(
      holdsAt({
        record: { kind: "dependency-record", dependency: "zod", nativeWay: "hand-written parsing", whyNotEnough: "Each adapter would repeat its checks." },
        site: { symptom: OUTSIDE_IMPORT, file: ADAPTER, party: reportedAs("zod") },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });
});

describe("overlapsAt, whatever outside party a finding there names", () => {
  it.each([
    { record: UUID_BOUNDARY, symptom: OUTSIDE_IMPORT, file: IDS_FILE },
    { record: ADAPTER_DEVIATION, symptom: OUTSIDE_IMPORT, file: ADAPTER },
    { record: IMPORT_LOCATION, symptom: OUTSIDE_IMPORT, file: ADAPTER },
  ])("finds a $record.kind reaching some finding of $symptom.name at $file", ({ record, symptom, file }) => {
    expect(overlapsAt({ record, symptom, file })).toBe("holds");
  });

  it.each([
    { record: UUID_BOUNDARY, symptom: CLAIMED_TYPE, file: IDS_FILE },
    { record: ADAPTER_DEVIATION, symptom: CLAIMED_TYPE, file: ADAPTER },
    { record: IMPORT_LOCATION, symptom: OUTSIDE_IMPORT, file: OTHER_FILE },
  ])("finds a $record.kind reaching no finding of $symptom.name at $file", ({ record, symptom, file }) => {
    expect(overlapsAt({ record, symptom, file })).toBe("does-not-hold");
  });
});
