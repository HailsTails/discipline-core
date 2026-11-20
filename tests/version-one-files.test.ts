import { describe, expect, it } from "vitest";
import { exceptionsTextOf, selectionTextOf } from "./version-one-files.ts";

describe("selectionTextOf", () => {
  it("writes the clauses as a version 1 disciplines.json, two spaces to an indent, ending in a newline", () => {
    expect(selectionTextOf({ clauses: { "CD-1#any-cast": "audit" } })).toBe(
      '{\n  "version": 1,\n  "ruleSets": {},\n  "clauses": {\n    "CD-1#any-cast": "audit"\n  }\n}\n',
    );
  });
});

describe("exceptionsTextOf", () => {
  it("writes the exceptions as a version 1 discipline-exceptions.json, two spaces to an indent, ending in a newline", () => {
    expect(exceptionsTextOf({ exceptions: [{ kind: "file-carve-out", clause: "CD-1#any-cast", file: "src/a.ts" }] })).toBe(
      '{\n  "version": 1,\n  "exceptions": [\n    {\n      "kind": "file-carve-out",\n      "clause": "CD-1#any-cast",\n      "file": "src/a.ts"\n    }\n  ]\n}\n',
    );
  });

  it("writes no exceptions as an empty list", () => {
    expect(exceptionsTextOf({ exceptions: [] })).toBe('{\n  "version": 1,\n  "exceptions": []\n}\n');
  });
});
