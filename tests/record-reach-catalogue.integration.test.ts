import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createSymptomCatalogueRepository } from "../core/symptom-catalogue/read-symptom-catalogue.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { repositoryRootOf } from "./allowed-forms-proof.ts";
import { symptomsNamedByRecordReachButNotCatalogued } from "./symptom-catalogue-coverage.ts";

const REPO_ROOT = absolutePathSchema.parse(repositoryRootOf({ testFolder: import.meta.dirname }));

const reading = createSymptomCatalogueRepository({ fileText: createDefaultFileTextPort({}), path: createDefaultPathPort({}), ruleSetRoot: REPO_ROOT }).read({});

describe("the symptoms a record's reach names", () => {
  it("are all symptoms of the catalogue the tool ships", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");
    expect(symptomsNamedByRecordReachButNotCatalogued({ catalogue: reading.value.catalogue })).toEqual([]);
  });
});
