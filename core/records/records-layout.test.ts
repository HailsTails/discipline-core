import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../values/repo-path.ts";
import { namedRecordsFileOf, recordsFileStandingOf, singleRecordsFileOf } from "./records-layout.ts";

describe("recordsFileStandingOf", () => {
  it.each([
    { file: "hone-records/debt/text-past-its-reader.json", standing: { standing: "named", kind: "debt", name: "text-past-its-reader" } },
    { file: "hone-records/authorised-locations/claimed-type.json", standing: { standing: "named", kind: "authorised-locations", name: "claimed-type" } },
    { file: "hone-records/deviations/stub-with-vifn.json", standing: { standing: "named", kind: "deviations", name: "stub-with-vifn" } },
    { file: "hone-records/boundaries.json", standing: { standing: "single", kind: "boundaries" } },
    { file: "hone-records/dependencies.json", standing: { standing: "single", kind: "dependencies" } },
  ])("reads $file as a records file of its folder", ({ file, standing }) => {
    expect(recordsFileStandingOf({ file: repoPathSchema.parse(file) })).toEqual(standing);
  });

  it.each([
    { file: "hone-records/notes.md", why: "a file at the top that is not one of the two single files" },
    { file: "hone-records/debt/claimed-type.txt", why: "a file in a kind folder that is not JSON" },
    { file: "hone-records/debt/.json", why: "a JSON file with no name" },
    { file: "hone-records/carve-outs/claimed-type.json", why: "a folder that is not a kind" },
    { file: "hone-records/team/debt/claimed-type.json", why: "a folder inside a kind folder's place" },
    { file: "discipline-exceptions/authorised-locations/cd-6.json", why: "a file outside the records folder" },
    { file: "hone-records", why: "the records folder itself" },
  ])("reads $file as no records file: $why", ({ file }) => {
    expect(recordsFileStandingOf({ file: repoPathSchema.parse(file) })).toEqual({ standing: "not-a-records-file" });
  });
});

describe("the records file a record belongs in", () => {
  it("names a kind folder's file after the symptom or recipe it holds", () => {
    expect(namedRecordsFileOf({ kind: "authorised-locations", name: "claimed-type" })).toBe("hone-records/authorised-locations/claimed-type.json");
  });

  it("names a single file after its kind", () => {
    expect(singleRecordsFileOf({ kind: "boundaries" })).toBe("hone-records/boundaries.json");
  });
});
