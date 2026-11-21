import { describe, expect, it } from "vitest";
import { INSTALLED_DECLARATION_TEXT } from "./installed-declaration-text.ts";

describe("INSTALLED_DECLARATION_TEXT", () => {
  it("is the declaration the installed ESLint's boundary supplies, which types the projection as that ESLint's configuration blocks", () => {
    expect(INSTALLED_DECLARATION_TEXT).toContain("declare const projection: Linter.Config[];\nexport default projection;\n");
  });
});
