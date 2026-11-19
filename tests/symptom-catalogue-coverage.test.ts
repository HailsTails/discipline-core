import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import { type SymptomCatalogue, symptomNameSchema } from "../core/symptom-catalogue/symptom-catalogue.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { catalogueCoverageOf, formSectionsOf, symptomNamesOf } from "./symptom-catalogue-coverage.ts";

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

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  recipes: [],
  recordKinds: [],
  symptoms: [],
  clauses: [
    {
      clause: clauseAddressSchema.parse("CD-44#parameter-mutation"),
      sight: { kind: "one-symptom", symptom: symptomNameSchema.parse("write-into-a-parameter") },
    },
    {
      clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
      sight: {
        kind: "symptom-by-form",
        forms: [
          { section: "branching-with-if", symptom: symptomNameSchema.parse("branch-in-a-test") },
          { section: "a-let", symptom: symptomNameSchema.parse("rebinding") },
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
      principles: [],
      rules: [],
      recipes: [],
      recordKinds: [],
      symptoms: [],
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
    const catalogue: SymptomCatalogue = {
      principles: [],
      rules: [],
      recipes: [],
      recordKinds: [],
      symptoms: [
        {
          name: symptomNameSchema.parse("rebinding"),
          title: "Rebinding",
          seen: "A `let` assigned again.",
          mayIndicate: [],
          breachUsuallySits: "The unit.",
          recipes: [],
          answeredBy: [],
        },
        {
          name: symptomNameSchema.parse("loop-keyword"),
          title: "Loop keyword",
          seen: "`for` or `while`.",
          mayIndicate: [],
          breachUsuallySits: "The unit.",
          recipes: [],
          answeredBy: [],
        },
      ],
      clauses: [],
    };
    expect(symptomNamesOf({ catalogue })).toEqual(["rebinding", "loop-keyword"]);
  });
});
