import { describe, expect, it } from "vitest";
import { ENTRY_DECLARATIONS, emittingDeclarations } from "./emitting-declarations.ts";

describe("emittingDeclarations", () => {
  it("emits the given declarations without a diagnostic, whatever the entries asked for", async () => {
    await expect(emittingDeclarations({ declarations: ENTRY_DECLARATIONS }).emit({ sourceRoot: "/package", entryPoints: ["api/missing.ts"] })).resolves.toEqual({
      outcome: "ok",
      value: { declarations: ENTRY_DECLARATIONS, diagnostics: [] },
    });
  });
});
