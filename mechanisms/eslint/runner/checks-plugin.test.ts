import { describe, expect, it } from "vitest";
import { CHECKS_PLUGIN_CATALOGUE } from "../../../tests/checks-plugin-catalogue.ts";
import cd2Plugin from "../CD-2/cd2/cd2.eslint-plugin.ts";
import CD_2_PIECE from "../CD-2/piece.json" with { type: "json" };
import cd27Plugin from "../CD-27/cd27/cd27.eslint-plugin.ts";
import CD_27_PIECE from "../CD-27/piece.json" with { type: "json" };
import cd40Plugin from "../CD-40/cd40/cd40.eslint-plugin.ts";
import CD_40_PIECE from "../CD-40/piece.json" with { type: "json" };
import { checksPluginOf, inSymptomWords } from "./checks-plugin.ts";

const SOURCES = [
  { piece: CD_2_PIECE, plugin: cd2Plugin },
  { piece: CD_27_PIECE, plugin: cd27Plugin },
  { piece: CD_40_PIECE, plugin: cd40Plugin },
];

const PLUGIN = checksPluginOf({ checks: CHECKS_PLUGIN_CATALOGUE.checks, sources: SOURCES });

describe("checksPluginOf", () => {
  it("names itself as the package's one plugin export", () => {
    expect(PLUGIN.meta).toEqual({ name: "@hailstails/hone/eslint-plugin", version: "0.0.0-local" });
  });

  it("holds one rule for each check on ESLint, named <symptom>/<check>, and none for a check that runs elsewhere", () => {
    expect(PLUGIN.rules).toEqual({
      "test-switched-off/skipped-tests": expect.anything(),
      "claimed-type/non-null-assertions": expect.anything(),
      "positional-parameters/parameter-count": expect.anything(),
    });
  });

  it("gives each rule the meta of the piece's rule it runs, its messages under the symptom's title", () => {
    expect(PLUGIN.rules).toMatchObject({
      "test-switched-off/skipped-tests": {
        meta: {
          type: "problem",
          schema: [],
          messages: { modifiedTest: "Test switched off: remove the skip so the test runs, or delete the test." },
        },
      },
    });
  });

  it("holds no rule for a check whose piece is not among its sources", () => {
    expect(checksPluginOf({ checks: CHECKS_PLUGIN_CATALOGUE.checks, sources: [{ piece: CD_27_PIECE, plugin: cd27Plugin }] }).rules).toEqual({
      "test-switched-off/skipped-tests": expect.anything(),
    });
  });

  it("holds no rule from a source that is not a piece and its plugin", () => {
    expect(checksPluginOf({ checks: CHECKS_PLUGIN_CATALOGUE.checks, sources: [{ piece: { clauses: "none" }, plugin: cd27Plugin }] }).rules).toEqual({});
  });
});

describe("inSymptomWords", () => {
  it.each<{ readonly name: string; readonly message: string; readonly worded: string }>([
    { name: "a numbered message", message: "CD-27: remove the focus so every test runs.", worded: "Test switched off: remove the focus so every test runs." },
    { name: "an unnumbered message", message: "Unexpected focus.", worded: "Test switched off: Unexpected focus." },
    { name: "a number later in the message", message: "see CD-27: later", worded: "Test switched off: see CD-27: later" },
  ])("words $name under the symptom's title", ({ message, worded }) => {
    expect(inSymptomWords({ message, title: "Test switched off" })).toBe(worded);
  });
});
