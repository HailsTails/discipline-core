import { describe, expect, it } from "vitest";
import { systemErrorOf } from "./system-error.ts";

describe("systemErrorOf", () => {
  it("is an error carrying the message and the system code", () => {
    const error = systemErrorOf({ code: "EEXIST", message: "file already exists" });
    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty("message", "file already exists");
    expect(error).toHaveProperty("code", "EEXIST");
  });
});
