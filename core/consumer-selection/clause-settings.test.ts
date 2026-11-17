import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { clauseSettingsSchema, settledPieceSettings } from "./clause-settings.ts";

const ADDRESS = clauseAddressSchema.parse("CD-19#import-boundaries");
const DECLARING_PIECE = { module: "import-boundaries.ts", clauseSettings: { confinedSpecifiers: [] } };

describe("clauseSettingsSchema", () => {
  it("reads each clause address with its settings object", () => {
    expect(clauseSettingsSchema.parse({ "CD-19#import-boundaries": { confinedSpecifiers: ["eslint"] } })).toEqual([
      [{ ruleSet: "hone", discipline: "CD-19", clause: "import-boundaries" }, { confinedSpecifiers: ["eslint"] }],
    ]);
  });

  it.each([
    { name: "a key that is not a clause address", settings: { "CD-19 import-boundaries": {} } },
    { name: "settings that are not an object", settings: { "CD-19#import-boundaries": "eslint" } },
  ])("refuses $name", ({ settings }) => {
    expect(clauseSettingsSchema.safeParse(settings).success).toBe(false);
  });
});

describe("settledPieceSettings", () => {
  it("keeps the piece's settings when the repository gives none", () => {
    expect(settledPieceSettings({ address: ADDRESS, pieceSettings: DECLARING_PIECE, given: undefined })).toEqual({
      outcome: "ok",
      value: DECLARING_PIECE,
    });
  });

  it("replaces a declared setting with the repository's value", () => {
    expect(
      settledPieceSettings({ address: ADDRESS, pieceSettings: DECLARING_PIECE, given: { confinedSpecifiers: ["eslint"] } }),
    ).toEqual({
      outcome: "ok",
      value: { module: "import-boundaries.ts", clauseSettings: { confinedSpecifiers: ["eslint"] } },
    });
  });

  it.each([
    { name: "declares no clauseSettings", pieceSettings: { module: "import-boundaries.ts" } },
    { name: "declares an empty clauseSettings", pieceSettings: { module: "import-boundaries.ts", clauseSettings: {} } },
  ])("refuses repository settings for a piece that $name", ({ pieceSettings }) => {
    expect(settledPieceSettings({ address: ADDRESS, pieceSettings, given: { confinedSpecifiers: [] } })).toEqual({
      outcome: "failed",
      error: "clauseSettings for CD-19#import-boundaries: its piece takes no settings",
    });
  });

  it("refuses a setting the piece does not declare, naming the ones it does", () => {
    expect(
      settledPieceSettings({ address: ADDRESS, pieceSettings: DECLARING_PIECE, given: { module: "x.ts", extra: 1 } }),
    ).toEqual({
      outcome: "failed",
      error: "clauseSettings for CD-19#import-boundaries: its piece takes no module, extra; it takes confinedSpecifiers",
    });
  });
});
