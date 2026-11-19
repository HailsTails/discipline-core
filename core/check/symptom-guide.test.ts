import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import type { RecordKind, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { SymptomCatalogueRepository } from "../symptom-catalogue/symptom-catalogue-repository.ts";
import { symptomGuideFor } from "./symptom-guide.ts";

const POSIX = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const ENTRY_URL = "file:///repo/node_modules/@hailstails/hone/core/check/tool-command.ts";

const presentFiles = (): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>(),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
});

const absentFiles = (): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>(),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
  write: vi.fn<FileTextPort["write"]>(),
});

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  symptoms: [],
  clauses: [],
};

const readingCatalogue = (): SymptomCatalogueRepository => ({
  read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({ outcome: "ok", value: { held: "catalogue", catalogue: CATALOGUE } }),
});

const holdingNoCatalogue = (): SymptomCatalogueRepository => ({
  read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({ outcome: "ok", value: { held: "none" } }),
});

const failingCatalogue = (): SymptomCatalogueRepository => ({
  read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({
    outcome: "failed",
    error: { kind: "file-malformed", path: "/repo/node_modules/@hailstails/hone/rules/typescript/symptoms.json", detail: "Unexpected end" },
  }),
});

describe("symptomGuideFor", () => {
  it("reads the installed catalogue and points at its page as the repository shows it", () => {
    expect(
      symptomGuideFor({
        process: { arguments: ["--repo", "/repo"] },
        path: POSIX,
        fileText: presentFiles(),
        moduleUrl: ENTRY_URL,
        symptomCatalogueOf: vi.fn().mockReturnValue(readingCatalogue()),
      }),
    ).toEqual({
      outcome: "ok",
      value: { guide: "catalogue", catalogue: CATALOGUE, page: "node_modules/@hailstails/hone/rules/typescript/symptoms.md" },
    });
  });

  it("gives no guide when the install holds no catalogue", () => {
    expect(
      symptomGuideFor({
        process: { arguments: ["--repo", "/repo"] },
        path: POSIX,
        fileText: presentFiles(),
        moduleUrl: ENTRY_URL,
        symptomCatalogueOf: vi.fn().mockReturnValue(holdingNoCatalogue()),
      }),
    ).toEqual({ outcome: "ok", value: { guide: "none" } });
  });

  it("reads the catalogue from the install root", () => {
    const fileText = presentFiles();
    const symptomCatalogueOf = vi.fn().mockReturnValue(readingCatalogue());

    symptomGuideFor({ process: { arguments: ["--repo", "/repo"] }, path: POSIX, fileText, moduleUrl: ENTRY_URL, symptomCatalogueOf });

    expect(symptomCatalogueOf).toHaveBeenCalledExactlyOnceWith({ fileText, path: POSIX, ruleSetRoot: "/repo/node_modules/@hailstails/hone" });
  });

  it("fails as the check does when the repository holds no selection", () => {
    expect(
      symptomGuideFor({
        process: { arguments: ["--repo", "/repo"] },
        path: POSIX,
        fileText: absentFiles(),
        moduleUrl: ENTRY_URL,
        symptomCatalogueOf: vi.fn().mockReturnValue(readingCatalogue()),
      }),
    ).toEqual({ outcome: "failed", error: { kind: "selection-absent", repo: "/repo" } });
  });

  it("fails naming the catalogue as the repository shows it when the catalogue cannot be read", () => {
    expect(
      symptomGuideFor({
        process: { arguments: ["--repo", "/repo"] },
        path: POSIX,
        fileText: presentFiles(),
        moduleUrl: ENTRY_URL,
        symptomCatalogueOf: vi.fn().mockReturnValue(failingCatalogue()),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: "node_modules/@hailstails/hone/rules/typescript/symptoms.json", detail: "Unexpected end" },
    });
  });
});
