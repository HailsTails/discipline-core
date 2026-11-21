import { describe, expect, it } from "vitest";
import { projectionFileNameOf } from "./projection-file-name.ts";

describe("projectionFileNameOf", () => {
  it("names the file hone project writes for an engine after that engine", () => {
    expect(projectionFileNameOf({ engineName: "eslint" })).toBe("hone.eslint.mjs");
  });
});
