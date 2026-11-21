import { describe, expect, it } from "vitest";
import { AFTER, AFTER_TRACKED, BEFORE, BEFORE_TRACKED, fixtureFilesOf } from "./walkthrough-repositories.ts";

describe("the walkthrough repositories", () => {
  it("track exactly the files the fixed and unfixed fixture folders hold, since git is the only port stubbed", () => {
    expect({ before: fixtureFilesOf({ folder: BEFORE }), after: fixtureFilesOf({ folder: AFTER }) }).toEqual({ before: [...BEFORE_TRACKED], after: [...AFTER_TRACKED] });
  });
});
