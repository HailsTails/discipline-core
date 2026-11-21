import { describe, expect, it } from "vitest";
import { settingsTextOf } from "./version-two-files.ts";

describe("settingsTextOf", () => {
  it("writes the checks and the excluded paths as a version 2 hone.config.json, two spaces to an indent, ending in a newline", () => {
    expect(settingsTextOf({ checks: { "claimed-type#cast-to-any": "walker" }, exclude: ["src/generated"] })).toBe(
      '{\n  "version": 2,\n  "ruleSets": {},\n  "checks": {\n    "claimed-type#cast-to-any": "walker"\n  },\n  "exclude": [\n    "src/generated"\n  ]\n}\n',
    );
  });

  it("writes no excluded paths as an empty list", () => {
    expect(settingsTextOf({ checks: {}, exclude: [] })).toBe('{\n  "version": 2,\n  "ruleSets": {},\n  "checks": {},\n  "exclude": []\n}\n');
  });
});
