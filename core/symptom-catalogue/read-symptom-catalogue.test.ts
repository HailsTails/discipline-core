import { describe, expect, it, vi } from "vitest";
import type { FilePresence, FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { createSymptomCatalogueRepository, SYMPTOM_CATALOGUE_SEGMENTS } from "./read-symptom-catalogue.ts";
import { principleNameSchema, symptomNameSchema } from "./symptom-catalogue.ts";

const RULE_SET_ROOT = absolutePathSchema.parse("/install");

const CATALOGUE_PATH = "/install/rules/typescript/symptoms.json";

const CATALOGUE_TEXT = `{
  "version": 1,
  "principles": [{ "name": "no-hidden-effects", "title": "No hidden effects" }],
  "rules": [],
  "recipes": [],
  "recordKinds": [{ "name": "debt", "title": "Debt", "todaysFormat": "file-carve-out" }],
  "symptoms": [
    {
      "name": "rebinding",
      "title": "Rebinding",
      "seen": "A \`let\` assigned again.",
      "mayIndicate": [{ "case": "Makes a new value", "points": [{ "principle": "no-hidden-effects" }] }],
      "breachUsuallySits": "The unit.",
      "recipes": [],
      "answeredBy": [{ "kind": "debt", "when": "a known breach not yet paid" }]
    }
  ],
  "clauses": [{ "clause": "CD-44#parameter-reassignment", "sight": { "kind": "one-symptom", "symptom": "rebinding" } }]
}`;

const fileTextHolding = (request: { readonly presence: FilePresence; readonly read: ReturnType<FileTextPort["read"]> }): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue(request.read),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue(request.presence),
  write: vi.fn<FileTextPort["write"]>(),
});

const pathJoiningTo = (joined: string): Pick<PathPort, "join"> => ({
  join: vi.fn<PathPort["join"]>().mockReturnValue(joined),
});

describe("SYMPTOM_CATALOGUE_SEGMENTS", () => {
  it("places the catalogue in the rule set's TypeScript folder", () => {
    expect(SYMPTOM_CATALOGUE_SEGMENTS).toEqual(["rules", "typescript", "symptoms.json"]);
  });
});

describe("createSymptomCatalogueRepository", () => {
  it("reads the catalogue under the rule set's root into its typed form", () => {
    const fileText = fileTextHolding({ presence: "present", read: { outcome: "ok", value: CATALOGUE_TEXT } });
    const path = pathJoiningTo(CATALOGUE_PATH);
    expect(createSymptomCatalogueRepository({ fileText, path, ruleSetRoot: RULE_SET_ROOT }).read({})).toEqual({
      outcome: "ok",
      value: {
        principles: [{ name: principleNameSchema.parse("no-hidden-effects"), title: "No hidden effects" }],
        rules: [],
        recipes: [],
        recordKinds: [{ name: "debt", title: "Debt", todaysFormat: "file-carve-out" }],
        symptoms: [
          {
            name: symptomNameSchema.parse("rebinding"),
            title: "Rebinding",
            seen: "A `let` assigned again.",
            mayIndicate: [{ case: "Makes a new value", points: [{ kind: "principle", name: principleNameSchema.parse("no-hidden-effects") }] }],
            breachUsuallySits: "The unit.",
            recipes: [],
            answeredBy: [{ kind: "debt", when: "a known breach not yet paid" }],
          },
        ],
        clauses: [
          { clause: clauseAddressSchema.parse("CD-44#parameter-reassignment"), sight: { kind: "one-symptom", symptom: symptomNameSchema.parse("rebinding") } },
        ],
      },
    });
    expect(path.join).toHaveBeenCalledExactlyOnceWith({ segments: ["/install", "rules", "typescript", "symptoms.json"] });
    expect(fileText.exists).toHaveBeenCalledExactlyOnceWith({ path: CATALOGUE_PATH });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: CATALOGUE_PATH });
    expect(fileText.write).not.toHaveBeenCalled();
  });

  it("gives an empty catalogue, reading nothing, when the rule set holds no catalogue", () => {
    const fileText = fileTextHolding({ presence: "absent", read: { outcome: "ok", value: CATALOGUE_TEXT } });
    expect(createSymptomCatalogueRepository({ fileText, path: pathJoiningTo(CATALOGUE_PATH), ruleSetRoot: RULE_SET_ROOT }).read({})).toEqual({
      outcome: "ok",
      value: { principles: [], rules: [], recipes: [], recordKinds: [], symptoms: [], clauses: [] },
    });
    expect(fileText.read).not.toHaveBeenCalled();
    expect(fileText.write).not.toHaveBeenCalled();
  });

  it("fails file-unreadable when the catalogue cannot be read", () => {
    const fileText = fileTextHolding({ presence: "present", read: { outcome: "failed", error: { kind: "unreadable", path: CATALOGUE_PATH, detail: "EACCES" } } });
    expect(createSymptomCatalogueRepository({ fileText, path: pathJoiningTo(CATALOGUE_PATH), ruleSetRoot: RULE_SET_ROOT }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: CATALOGUE_PATH, detail: "EACCES" },
    });
  });

  it("fails file-malformed when the catalogue is not JSON", () => {
    const fileText = fileTextHolding({ presence: "present", read: { outcome: "ok", value: "{ not json" } });
    expect(createSymptomCatalogueRepository({ fileText, path: pathJoiningTo(CATALOGUE_PATH), ruleSetRoot: RULE_SET_ROOT }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: CATALOGUE_PATH, detail: expect.any(String) },
    });
  });

  it("fails unsupported-version when the catalogue is of a later version", () => {
    const fileText = fileTextHolding({ presence: "present", read: { outcome: "ok", value: '{ "version": 2 }' } });
    expect(createSymptomCatalogueRepository({ fileText, path: pathJoiningTo(CATALOGUE_PATH), ruleSetRoot: RULE_SET_ROOT }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "unsupported-version", path: CATALOGUE_PATH, found: 2 },
    });
  });

  it("fails file-malformed, saying why, when the catalogue names a symptom it does not hold", () => {
    const fileText = fileTextHolding({
      presence: "present",
      read: {
        outcome: "ok",
        value: '{ "version": 1, "principles": [], "rules": [], "recipes": [], "recordKinds": [], "symptoms": [], "clauses": [{ "clause": "CD-15#loops", "sight": { "kind": "one-symptom", "symptom": "loop-keyword" } }] }',
      },
    });
    expect(createSymptomCatalogueRepository({ fileText, path: pathJoiningTo(CATALOGUE_PATH), ruleSetRoot: RULE_SET_ROOT }).read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: CATALOGUE_PATH, detail: "✖ clauses names loop-keyword, which the catalogue does not hold" },
    });
  });
});
