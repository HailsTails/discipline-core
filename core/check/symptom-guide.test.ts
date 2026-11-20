import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import { createPathPort } from "../platform-ports/path-port.ts";
import type { RecordKind, SymptomCatalogue } from "../symptom-catalogue/symptom-catalogue.ts";
import type { SymptomCatalogueRepository } from "../symptom-catalogue/symptom-catalogue-repository.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { type SymptomCatalogueOf, symptomGuideIn } from "./symptom-guide.ts";

const POSIX = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const REPO_ROOT = absolutePathSchema.parse("/repo");

const INSTALL_ROOT = absolutePathSchema.parse("/repo/node_modules/@hailstails/hone");

const FILE_TEXT: FileTextPort = {
  read: vi.fn<FileTextPort["read"]>(),
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>(),
};

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

describe("symptomGuideIn", () => {
  it("reads the installed catalogue and points at its page as the repository shows it", () => {
    const repository: SymptomCatalogueRepository = {
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({ outcome: "ok", value: { held: "catalogue", catalogue: CATALOGUE } }),
    };

    expect(
      symptomGuideIn({
        path: POSIX,
        fileText: FILE_TEXT,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        symptomCatalogueOf: vi.fn<SymptomCatalogueOf>().mockReturnValue(repository),
      }),
    ).toEqual({ guide: "catalogue", catalogue: CATALOGUE, page: "node_modules/@hailstails/hone/rules/typescript/symptoms.md" });
  });

  it("asks for the catalogue under the install root, through the ports it is given", () => {
    const repository: SymptomCatalogueRepository = {
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({ outcome: "ok", value: { held: "none" } }),
    };
    const symptomCatalogueOf = vi.fn<SymptomCatalogueOf>().mockReturnValue(repository);

    symptomGuideIn({ path: POSIX, fileText: FILE_TEXT, repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, symptomCatalogueOf });

    expect(symptomCatalogueOf).toHaveBeenCalledExactlyOnceWith({ fileText: FILE_TEXT, path: POSIX, ruleSetRoot: "/repo/node_modules/@hailstails/hone" });
  });

  it("gives no guide when the install holds no catalogue", () => {
    const repository: SymptomCatalogueRepository = {
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({ outcome: "ok", value: { held: "none" } }),
    };

    expect(
      symptomGuideIn({
        path: POSIX,
        fileText: FILE_TEXT,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        symptomCatalogueOf: vi.fn<SymptomCatalogueOf>().mockReturnValue(repository),
      }),
    ).toEqual({ guide: "none" });
  });

  it("gives a guide that says why the catalogue was not read, naming it as the repository shows it", () => {
    const repository: SymptomCatalogueRepository = {
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "file-malformed", path: "/repo/node_modules/@hailstails/hone/rules/typescript/symptoms.json", detail: "Unexpected end" },
      }),
    };

    expect(
      symptomGuideIn({
        path: POSIX,
        fileText: FILE_TEXT,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        symptomCatalogueOf: vi.fn<SymptomCatalogueOf>().mockReturnValue(repository),
      }),
    ).toEqual({ guide: "unreadable", failure: "file-malformed node_modules/@hailstails/hone/rules/typescript/symptoms.json Unexpected end" });
  });
});
