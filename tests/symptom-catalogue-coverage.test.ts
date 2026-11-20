import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { RecordKind, Symptom, SymptomCatalogue } from "../core/symptom-catalogue/symptom-catalogue.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { catalogueCoverageOf, correctUseNotesOf, formSectionsOf, symptomNamesOf } from "./symptom-catalogue-coverage.ts";

const RULE_SET_ROOT = absolutePathSchema.parse("/install");

const DISCIPLINE_PATH = "/install/rules/CD-44/discipline.json";

const CD44_TEXT = `{
  "version": 1,
  "id": "CD-44",
  "clauses": [
    { "kind": "judgement", "id": "parameter-mutation", "summary": "Write into no parameter.", "enforcedBy": "review" },
    { "kind": "judgement", "id": "parameter-reassignment", "summary": "Rebind no parameter.", "enforcedBy": "review" }
  ]
}`;

const symptomNamed = (name: string): Symptom => ({
  name,
  title: name,
  seen: name,
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
});

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const NOTHING_CATALOGUED: SymptomCatalogue = {
  principles: [],
  rules: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  symptoms: [],
  clauses: [],
};

const CATALOGUE: SymptomCatalogue = {
  ...NOTHING_CATALOGUED,
  clauses: [
    {
      clause: clauseAddressSchema.parse("CD-44#parameter-mutation"),
      sight: { kind: "one-symptom", symptom: symptomNamed("write-into-a-parameter") },
    },
    {
      clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
      sight: {
        kind: "symptom-by-form",
        forms: [
          { section: "branching-with-if", symptom: symptomNamed("branch-in-a-test") },
          { section: "a-let", symptom: symptomNamed("rebinding") },
        ],
      },
    },
  ],
};

const fileTextReading = (read: ReturnType<FileTextPort["read"]>): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue(read),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
});

const pathJoiningTo = (joined: string): PathPort => ({
  join: vi.fn<PathPort["join"]>().mockReturnValue(joined),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
});

describe("catalogueCoverageOf", () => {
  it("names each clause a discipline defines that the catalogue lacks, and each catalogued clause no discipline defines", () => {
    const fileText = fileTextReading({ outcome: "ok", value: CD44_TEXT });
    const path = pathJoiningTo(DISCIPLINE_PATH);
    expect(catalogueCoverageOf({ catalogue: CATALOGUE, fileText, path, ruleSetRoot: RULE_SET_ROOT, disciplines: ["CD-44"] })).toEqual({
      uncatalogued: ["CD-44#parameter-reassignment"],
      unknown: ["CD-27#test-body-logic"],
      unreadable: [],
    });
    expect(path.join).toHaveBeenCalledExactlyOnceWith({ segments: ["/install", "rules", "CD-44", "discipline.json"] });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: DISCIPLINE_PATH });
    expect(fileText.write).not.toHaveBeenCalled();
  });

  it("names nothing missing when the catalogue lists each clause of the disciplines and no other", () => {
    const fileText = fileTextReading({ outcome: "ok", value: CD44_TEXT });
    const catalogue: SymptomCatalogue = {
      ...NOTHING_CATALOGUED,
      clauses: [
        { clause: clauseAddressSchema.parse("CD-44#parameter-mutation"), sight: { kind: "outside-the-cases" } },
        { clause: clauseAddressSchema.parse("CD-44#parameter-reassignment"), sight: { kind: "outside-the-cases" } },
      ],
    };
    expect(
      catalogueCoverageOf({ catalogue, fileText, path: pathJoiningTo(DISCIPLINE_PATH), ruleSetRoot: RULE_SET_ROOT, disciplines: ["CD-44"] }),
    ).toEqual({ uncatalogued: [], unknown: [], unreadable: [] });
  });

  it("names a discipline file it cannot read, and counts its clauses as defined by none", () => {
    const fileText = fileTextReading({ outcome: "failed", error: { kind: "unreadable", path: DISCIPLINE_PATH, detail: "ENOENT" } });
    expect(
      catalogueCoverageOf({ catalogue: CATALOGUE, fileText, path: pathJoiningTo(DISCIPLINE_PATH), ruleSetRoot: RULE_SET_ROOT, disciplines: ["CD-44"] }),
    ).toEqual({
      uncatalogued: [],
      unknown: ["CD-44#parameter-mutation", "CD-27#test-body-logic"],
      unreadable: [{ kind: "file-unreadable", path: DISCIPLINE_PATH, detail: "ENOENT" }],
    });
  });

  it("names a folder that is not a discipline id as unreadable, reading nothing", () => {
    const fileText = fileTextReading({ outcome: "ok", value: CD44_TEXT });
    expect(
      catalogueCoverageOf({ catalogue: CATALOGUE, fileText, path: pathJoiningTo(DISCIPLINE_PATH), ruleSetRoot: RULE_SET_ROOT, disciplines: ["typescript"] }),
    ).toEqual({
      uncatalogued: [],
      unknown: ["CD-44#parameter-mutation", "CD-27#test-body-logic"],
      unreadable: [{ kind: "unknown-discipline", address: "typescript" }],
    });
    expect(fileText.read).not.toHaveBeenCalled();
  });
});

describe("formSectionsOf", () => {
  it("lists the sections of a by-form clause in catalogue order", () => {
    expect(formSectionsOf({ catalogue: CATALOGUE, clause: "CD-27#test-body-logic" })).toEqual(["branching-with-if", "a-let"]);
  });

  it("lists no section for a clause that sees one symptom", () => {
    expect(formSectionsOf({ catalogue: CATALOGUE, clause: "CD-44#parameter-mutation" })).toEqual([]);
  });

  it("lists no section for a clause the catalogue does not hold", () => {
    expect(formSectionsOf({ catalogue: CATALOGUE, clause: "CD-15#loops" })).toEqual([]);
  });
});

describe("symptomNamesOf", () => {
  it("lists each symptom's name in catalogue order", () => {
    expect(symptomNamesOf({ catalogue: { ...NOTHING_CATALOGUED, symptoms: [symptomNamed("rebinding"), symptomNamed("loop-keyword")] } })).toEqual([
      "rebinding",
      "loop-keyword",
    ]);
  });
});

const LOOP_KEYWORD: Symptom = {
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "A for or while statement.",
  mayIndicate: [{ case: "Builds a value", points: [{ kind: "principle", principle: { name: "one-place-decides", title: "One place decides" } }] }],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [{ situation: "draining a stream", kind: AUTHORISED_LOCATION, at: "in its source's adapter" }],
};

describe("correctUseNotesOf", () => {
  it("renders the note of each symptom that has a correct use, in catalogue order, and none for a symptom without one", () => {
    expect(
      correctUseNotesOf({
        guide: { guide: "catalogue", catalogue: { ...NOTHING_CATALOGUED, symptoms: [symptomNamed("rebinding"), LOOP_KEYWORD] }, page: "symptoms.md" },
      }),
    ).toEqual([
      "loop-keyword: Loop keyword. May indicate: builds a value → One place decides. The breach usually sits in the unit. Draining a stream: an authorised location in its source's adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read symptoms.md#loop-keyword",
    ]);
  });
});