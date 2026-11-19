import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createSymptomCatalogueRepository } from "../core/symptom-catalogue/read-symptom-catalogue.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { TEST_BODY_SECTIONS } from "../mechanisms/audit/CD-27/test-body-logic.ts";
import { repositoryRootOf } from "./allowed-forms-proof.ts";
import { foldersUnder } from "./conformance-rows.ts";
import { catalogueCoverageOf, formSectionsOf, symptomNamesOf } from "./symptom-catalogue-coverage.ts";

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
});
