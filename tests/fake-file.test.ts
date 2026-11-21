import { describe, expect, it } from "vitest";
import { ABSENT_FILE, presentFile, presentJsonFile } from "./fake-file.ts";

describe("presentFile", () => {
  it("is a file that exists and reads as the text it is given", () => {
    expect(presentFile({ text: "{" })).toEqual({ read: { outcome: "ok", value: "{" }, presence: "present" });
  });
});

describe("presentJsonFile", () => {
  it("is a file that exists and reads as the JSON text of the document it is given", () => {
    expect(presentJsonFile({ document: { version: 1, clauses: {} } })).toEqual({
      read: { outcome: "ok", value: '{"version":1,"clauses":{}}' },
      presence: "present",
    });
  });
});

describe("ABSENT_FILE", () => {
  it("is a file that does not exist and cannot be read", () => {
    expect(ABSENT_FILE).toEqual({ read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } }, presence: "absent" });
  });
});
