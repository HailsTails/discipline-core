import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createSymptomCatalogueRepository } from "../core/symptom-catalogue/read-symptom-catalogue.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { TEST_BODY_SECTIONS } from "../mechanisms/audit/CD-27/test-body-logic.ts";
import { repositoryRootOf } from "./allowed-forms-proof.ts";
import { foldersUnder } from "./conformance-rows.ts";
import { catalogueCoverageOf, correctUseNotesOf, formSectionsOf, symptomNamesOf } from "./symptom-catalogue-coverage.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const REPO_ROOT = absolutePathSchema.parse(repositoryRootOf({ testFolder: import.meta.dirname }));

const disciplineTexts = import.meta.glob(["./rules/*/discipline.json"], { base: "../", query: "?raw", import: "default", eager: true });

const DISCIPLINES = foldersUnder({ table: disciplineTexts, prefix: "./rules/" });

const FILE_TEXT = createDefaultFileTextPort({});

const PATH = createDefaultPathPort({});

const SYMPTOMS_ON_THE_STEP_5_PAGE = [
  "date-used-directly",
  "ambient-randomness",
  "process-global-used-in-place",
  "outside-import-past-a-boundary",
  "outside-type-in-a-signature",
  "library-class-built-in-place",
  "text-past-its-reader",
  "schema-past-its-adapter",
  "claimed-type",
  "untyped-value",
  "own-type-guard",
  "type-derived-from-code",
  "strictness-weakened",
  "default-on-a-closed-union",
  "boolean-in-a-signature",
  "absence-standing-for-a-state",
  "default-for-a-required-value",
  "throw-between-our-units",
  "thrown-non-error",
  "failure-shaped-as-success",
  "catch-all-failure-kind",
  "loop-keyword",
  "write-into-a-parameter",
  "rebinding",
  "authored-class-or-this",
  "module-level-state",
  "long-function",
  "tangled-function",
  "work-inside-a-condition",
  "orchestrator-that-computes",
  "doer-calling-our-own-unit",
  "positional-parameters",
  "tuple-as-data",
  "wide-input",
  "wide-port",
  "inner-layer-imports-outer",
  "port-outside-the-domain",
  "adapter-built-outside-the-root",
  "port-named-for-a-mechanism",
  "double-with-a-body",
  "module-or-global-patched",
  "branch-in-a-test",
  "computed-value-in-a-test",
  "throw-or-catch-in-a-test",
  "unasserted-call",
  "answer-set-in-a-hook",
  "test-switched-off",
  "unit-without-a-running-test",
  "machine-touched-in-a-unit-test",
  "inherited-environment-in-a-subprocess",
  "behaviour-tested-away-from-its-owner",
  "integration-heavy-suite",
  "coverage-gate",
  "large-input-for-a-few-fields",
  "test-of-the-type-checker",
  "shorthand-name",
  "name-off-its-casing",
  "drawer-path",
  "types-only-file",
  "prose-in-code",
  "untracked-escape",
  "many-spellings-of-one-concept",
  "outside-dependency-vocabulary-for-basic-logic",
  "duplicate-decision",
  "change-spread-across-modules",
  "floating-version",
  "no-lock-file",
  "dependency-without-a-record",
  "tool-fetched-at-run-time",
  "edit-inside-vendored-code",
  "bundled-dependency",
];

const NOTES_OF_SYMPTOMS_WITH_A_CORRECT_USE = [
  "date-used-directly: Date used directly. May indicate: needs the current time → Ports declared inside, Written-out answers; does one job → Doer or orchestrator. The breach usually sits in the unit that should be passed the time, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the clock adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#date-used-directly",
  "ambient-randomness: Ambient randomness. May indicate: needs a random value or a new id → Ports declared inside, Written-out answers. The breach usually sits in the unit that should be passed the value, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the adapter for random values or new ids (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#ambient-randomness",
  "process-global-used-in-place: Process global used in place. May indicate: reads data from outside → No leak across a boundary; causes an effect → Ports declared inside; builds the real implementations → Ports declared inside. The breach usually sits at a missing port, or at an adapter not built at the entry point. Recipes: World values through a port; Adapter per outside party; Composition root. Correct use: a boundary record on the adapter that wraps the process (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#process-global-used-in-place",
  "outside-import-past-a-boundary: Outside import past a boundary. May indicate: uses a system or service outside the program → Outside dependencies stay at boundaries, Ports declared inside; takes an outside dependency → Outside dependencies stay at boundaries, Ports declared inside. The breach usually sits at a missing adapter and port. Recipes: Adapter per outside party; Port in the domain. Correct use: a boundary record on the adapter for that outside party (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#outside-import-past-a-boundary",
  "outside-type-in-a-signature: Outside type in a signature. May indicate: uses a system or service outside the program → Outside dependencies stay at boundaries, No leak across a boundary. The breach usually sits in the adapter that hands the outside type inward. Recipe: Adapter per outside party. Correct use: a boundary record on the adapter, or beyond it with a Conformist statement for an outside model adopted as ours (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#outside-type-in-a-signature",
  "library-class-built-in-place: Library class built in place. May indicate: takes an outside dependency → Outside dependencies stay at boundaries; keeps state or settings across calls → No hidden effects. The breach usually sits at a missing adapter. Recipes: Adapter per outside party; Closure factory. Correct use: a boundary record on that dependency's adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#library-class-built-in-place",
  "text-past-its-reader: Text past its reader. May indicate: reads data from outside → No leak across a boundary; sends data out → No leak across a boundary; uses a system or service outside the program → External behaviour sits at a boundary; states what the unit gives back → Straight-through tests, Written-out answers. The breach usually sits in a port that takes or gives text where it should carry objects. Recipes: Adapter per outside party; Map out at the adapter; Zod at the producer's adapter; Whole written-out expectation. Correct use: a boundary record on the adapter for whoever produced or receives the text (today: authorised-location). A use at one test site: an authorised location for this symptom alone (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#text-past-its-reader",
  "schema-past-its-adapter: Schema past its adapter. May indicate: reads data from outside → No leak across a boundary; gives a value its type → Declared, not asserted. The breach usually sits in the adapter, which hands the wire type inward instead of mapping it. Recipe: Zod at the producer's adapter. An outside model adopted as ours: a boundary record with a Conformist statement (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#schema-past-its-adapter",
  "claimed-type: Claimed type. May indicate: gives a value its type → Declared, not asserted; checks a value that may be one of several outcomes → Straight-through tests; builds an input for a test with a cast → Handed what it uses. The breach usually sits in the declaration: an input too wide, a generic not bounded, a missing parse. Recipes: Fix the declaration, not the value; Assert to narrow; One argument object. Correct use: an authorised location in the adapter whose outside contract forces it (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#claimed-type",
  "type-derived-from-code: Type derived from code. May indicate: gives a value its type → Declared, not asserted; names something → One word everywhere. The breach usually sits in the producer, which has no named type. Recipe: Named, exported type. Correct use: an authorised location in the adapter for an outside dependency that gives no named type (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#type-derived-from-code",
  "throw-between-our-units: Throw between our units. May indicate: an operation can fail → Failures are values; sends data out → No leak across a boundary. The breach usually sits in the unit, or at a missing mapping in the adapter. Recipes: Result union; Failure mapping at the adapter. Correct use: an authorised location at an adapter whose caller's contract is exceptions (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#throw-between-our-units",
  "loop-keyword: Loop keyword. May indicate: makes a new value → No hidden effects; causes an effect → Ports declared inside; coordinates other units → Doer or orchestrator. The breach usually sits in the unit. Recipe: Functional iteration. Draining a stream: an authorised location in its source's adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#loop-keyword",
  "double-with-a-body: Double with a body. May indicate: uses what a collaborator gives back → Written-out answers, Handed what it uses, Doer or orchestrator. The breach usually sits in a port too wide, or in a collaborator holding two decisions. Recipe: Stub with vi.fn. A fake, where a stub cannot do the test: a deviation from Stub with vi.fn (no record format yet). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#double-with-a-body",
  "shorthand-name: Shorthand name. May indicate: names something → One word everywhere. The breach usually sits in the name. Recipe: Whole words. A name an outside contract fixes: an authorised location (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#shorthand-name",
  "name-off-its-casing: Name off its casing. May indicate: names something → One word everywhere. The breach usually sits in the name. An outside contract's names, such as `PATH` or ESLint listener keys: an authorised location (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#name-off-its-casing",
  "dependency-without-a-record: Dependency without a record. May indicate: takes an outside dependency → Outside dependencies justified. The breach usually sits in the missing record. Recipe: Dependency record. Correct use: a dependency record naming the native way weighed and why it fell short (no record format yet). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#dependency-without-a-record",
  "edit-inside-vendored-code: Edit inside vendored code. May indicate: takes an outside dependency → Upstream stays untouched. The breach usually sits in the change. Recipe: Extension outside the vendored code. Drift, an edit impossible to apply as an extension: an authorised location stating when to drop it (today: authorised-location). Known debt: debt (today: file-carve-out). Read rules/typescript/symptoms.md#edit-inside-vendored-code",
];

const reading = createSymptomCatalogueRepository({ fileText: FILE_TEXT, path: PATH, ruleSetRoot: REPO_ROOT }).read({});

describe("rules/typescript/symptoms.json, read from this repository through the catalogue's reader", () => {
  it("reads into the typed catalogue", () => {
    expect(reading).toMatchObject({ outcome: "ok", value: { held: "catalogue" } });
  });

  it("lists each clause of every rules/*/discipline.json exactly once, and no other clause", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(DISCIPLINES).toHaveLength(40);
    expect(
      catalogueCoverageOf({ catalogue: reading.value.catalogue, fileText: FILE_TEXT, path: PATH, ruleSetRoot: REPO_ROOT, disciplines: DISCIPLINES }),
    ).toEqual({
      uncatalogued: [],
      unknown: [],
      unreadable: [],
    });
    expect(reading.value.catalogue.clauses).toHaveLength(60);
  });

  it("reads CD-27#test-body-logic by form, one symptom for each section its findings name, in the walker's order", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(formSectionsOf({ catalogue: reading.value.catalogue, clause: "CD-27#test-body-logic" })).toEqual(TEST_BODY_SECTIONS);
  });

  it("holds every symptom on the Step 5 page, in its order", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(symptomNamesOf({ catalogue: reading.value.catalogue })).toEqual(SYMPTOMS_ON_THE_STEP_5_PAGE);
  });

  it("renders each symptom that has a correct use as a note that reads as sentences, in catalogue order", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");

    expect(correctUseNotesOf({ guide: { guide: "catalogue", catalogue: reading.value.catalogue, page: "rules/typescript/symptoms.md" } })).toEqual(
      NOTES_OF_SYMPTOMS_WITH_A_CORRECT_USE,
    );
  });
});