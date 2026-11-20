import { describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../tests/causal-why-chain.ts";
import type { Case, Recipe, RecordKind, Symptom, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { BoundaryRecord, HoneRecord, RuntimeFacility } from "./hone-record.ts";
import { holdsAt, type RaisedBy } from "./record-reach.ts";

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
  symptoms: [DATE_USED_DIRECTLY, AMBIENT_RANDOMNESS, PROCESS_GLOBAL, OUTSIDE_IMPORT, LIBRARY_CLASS, OUTSIDE_TYPE, CLAIMED_TYPE, DOUBLE_WITH_A_BODY],
  clauses: [],
  checks: [],
  namedBans: [{ outsideDependency: "lodash" }],
};

const ADAPTER = repoPathSchema.parse("src/adapters/stripe-webhook.ts");

const OTHER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const NOT_AN_IMPORT: RaisedBy = { kind: "not-an-import" };

const RUNTIME_REACH: readonly { readonly facility: RuntimeFacility; readonly symptom: Symptom }[] = [
  { facility: "clock", symptom: DATE_USED_DIRECTLY },
  { facility: "random", symptom: AMBIENT_RANDOMNESS },
  { facility: "process", symptom: PROCESS_GLOBAL },
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

describe("holdsAt, debt and authorised locations", () => {
  it.each([{ record: DEBT }, { record: AUTHORISED_LOCATION }, { record: AUTHORISED_LOCATION_OFF_THE_CATALOGUE }])(
    "holds a $record.kind on its symptom at its exact file, whatever it claims beyond that",
    ({ record }) => {
      expect(holdsAt({ record, site: { symptom: CLAIMED_TYPE, file: ADAPTER, raisedBy: NOT_AN_IMPORT }, catalogue: CATALOGUE })).toBe("holds");
    },
  );

  it.each([{ record: DEBT }, { record: AUTHORISED_LOCATION }])("does not hold a $record.kind on another symptom at its file", ({ record }) => {
    expect(holdsAt({ record, site: { symptom: DOUBLE_WITH_A_BODY, file: ADAPTER, raisedBy: NOT_AN_IMPORT }, catalogue: CATALOGUE })).toBe("does-not-hold");
  });

  it.each([
    { record: DEBT, file: OTHER_FILE },
    { record: AUTHORISED_LOCATION, file: OTHER_FILE },
    { record: DEBT, file: repoPathSchema.parse("src/adapters/stripe-webhook.ts.bak") },
    { record: AUTHORISED_LOCATION, file: repoPathSchema.parse("src/adapters/stripe-webhook.ts/inner.ts") },
  ])("does not hold a $record.kind at $file, since its file never widens to a folder or a prefix", ({ record, file }) => {
    expect(holdsAt({ record, site: { symptom: CLAIMED_TYPE, file, raisedBy: NOT_AN_IMPORT }, catalogue: CATALOGUE })).toBe("does-not-hold");
  });
});

describe("holdsAt, deviations", () => {
  it("holds a deviation at its file on a symptom whose recipes include its recipe", () => {
    expect(holdsAt({ record: DEVIATION, site: { symptom: DOUBLE_WITH_A_BODY, file: ADAPTER, raisedBy: NOT_AN_IMPORT }, catalogue: CATALOGUE })).toBe("holds");
  });

  it("does not hold a deviation on a symptom whose recipes do not include its recipe", () => {
    expect(holdsAt({ record: DEVIATION, site: { symptom: CLAIMED_TYPE, file: ADAPTER, raisedBy: NOT_AN_IMPORT }, catalogue: CATALOGUE })).toBe("does-not-hold");
  });

  it("does not hold a deviation at another file", () => {
    expect(holdsAt({ record: DEVIATION, site: { symptom: DOUBLE_WITH_A_BODY, file: OTHER_FILE, raisedBy: NOT_AN_IMPORT }, catalogue: CATALOGUE })).toBe("does-not-hold");
  });

  it("holds a deviation over a finding raised by an import of a dependency that is not banned", () => {
    expect(
      holdsAt({ record: ADAPTER_DEVIATION, site: { symptom: OUTSIDE_IMPORT, file: ADAPTER, raisedBy: { kind: "import", specifier: "uuid" } }, catalogue: CATALOGUE }),
    ).toBe("holds");
  });

  it.each([{ specifier: "lodash" }, { specifier: "lodash/fp" }])(
    "does not hold a deviation over a finding raised by an import of $specifier, since no deviation makes a named ban correct",
    ({ specifier }) => {
      expect(holdsAt({ record: ADAPTER_DEVIATION, site: { symptom: OUTSIDE_IMPORT, file: ADAPTER, raisedBy: { kind: "import", specifier } }, catalogue: CATALOGUE })).toBe(
        "does-not-hold",
      );
    },
  );
});

describe("holdsAt, boundary records", () => {
  it.each([{ symptom: OUTSIDE_IMPORT }, { symptom: LIBRARY_CLASS }, { symptom: OUTSIDE_TYPE }])(
    "holds a boundary record on a package over $symptom.name in its module",
    ({ symptom }) => {
      expect(
        holdsAt({
          record: boundaryOn({ module: "src/adapters/ids.ts", outsideParty: { kind: "package", specifier: "uuid", dependency: "uuid" } }),
          site: { symptom, file: repoPathSchema.parse("src/adapters/ids.ts"), raisedBy: NOT_AN_IMPORT },
          catalogue: CATALOGUE,
        }),
      ).toBe("holds");
    },
  );

  it("holds a boundary record on a built-in over an outside import in a file inside its module folder", () => {
    expect(
      holdsAt({
        record: boundaryOn({ module: "src/adapters/files", outsideParty: { kind: "built-in", specifier: "node:fs" } }),
        site: { symptom: OUTSIDE_IMPORT, file: repoPathSchema.parse("src/adapters/files/read-text.ts"), raisedBy: NOT_AN_IMPORT },
        catalogue: CATALOGUE,
      }),
    ).toBe("holds");
  });

  it("does not hold a boundary record in a file that only shares its module's name as a prefix", () => {
    expect(
      holdsAt({
        record: boundaryOn({ module: "src/adapters/files", outsideParty: { kind: "built-in", specifier: "node:fs" } }),
        site: { symptom: OUTSIDE_IMPORT, file: repoPathSchema.parse("src/adapters/files-old.ts"), raisedBy: NOT_AN_IMPORT },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it.each(RUNTIME_REACH)("holds a boundary record on runtime:$facility over $symptom.name in its module", ({ facility, symptom }) => {
    expect(
      holdsAt({
        record: boundaryOn({ module: "src/adapters/world.ts", outsideParty: { kind: "runtime", facility } }),
        site: { symptom, file: repoPathSchema.parse("src/adapters/world.ts"), raisedBy: NOT_AN_IMPORT },
        catalogue: CATALOGUE,
      }),
    ).toBe("holds");
  });

  it("holds nothing for a boundary record on runtime:json, since no symptom names that facility yet", () => {
    expect(
      holdsAt({
        record: boundaryOn({ module: "src/adapters/json.ts", outsideParty: { kind: "runtime", facility: "json" } }),
        site: { symptom: OUTSIDE_IMPORT, file: repoPathSchema.parse("src/adapters/json.ts"), raisedBy: NOT_AN_IMPORT },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it("does not hold a boundary record on a runtime facility over an outside import", () => {
    expect(
      holdsAt({
        record: boundaryOn({ module: "src/adapters/system-clock.ts", outsideParty: { kind: "runtime", facility: "clock" } }),
        site: { symptom: OUTSIDE_IMPORT, file: repoPathSchema.parse("src/adapters/system-clock.ts"), raisedBy: NOT_AN_IMPORT },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it("does not hold a boundary record on a package over a symptom outside an outside party's reach", () => {
    expect(
      holdsAt({
        record: boundaryOn({ module: "src/adapters/stripe-webhook.ts", outsideParty: { kind: "package", specifier: "stripe", dependency: "stripe" } }),
        site: { symptom: CLAIMED_TYPE, file: ADAPTER, raisedBy: NOT_AN_IMPORT },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it("holds a boundary record on a named ban, since a ban refuses only a dependency record or a deviation", () => {
    expect(
      holdsAt({
        record: boundaryOn({ module: "src/adapters/collections.ts", outsideParty: { kind: "package", specifier: "lodash", dependency: "lodash" } }),
        site: { symptom: OUTSIDE_IMPORT, file: repoPathSchema.parse("src/adapters/collections.ts"), raisedBy: { kind: "import", specifier: "lodash" } },
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
        site: { symptom: OUTSIDE_IMPORT, file: ADAPTER, raisedBy: { kind: "import", specifier: "zod" } },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });
});
