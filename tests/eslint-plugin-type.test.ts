import { describe, expect, it } from "vitest";
import { createDefaultTypeScriptDeclarationPort } from "../scripts/typescript-declaration-port.ts";

const CONSUMER_TYPING = "tests/test-fixtures/consumer-proof/plugin-type/eslint-plugin-is-eslints.ts";

const PIECES_TYPING = "tests/test-fixtures/consumer-proof/plugin-type/pieces-are-eslints.ts";

const emitted = await createDefaultTypeScriptDeclarationPort({}).emit({ sourceRoot: `${import.meta.dirname}/..`, entryPoints: [CONSUMER_TYPING] });

const piecesEmitted = await createDefaultTypeScriptDeclarationPort({}).emit({ sourceRoot: `${import.meta.dirname}/..`, entryPoints: [PIECES_TYPING] });

describe("the plugin type the eslint-plugin entry ships, type-checked in memory by the package build's own port (CD-47: nothing is spawned or written)", () => {
  it("is ESLint's own plugin type to a consumer, alone and under a namespace in a flat config", () => {
    expect(emitted).toMatchObject({ outcome: "ok", value: { diagnostics: [] } });
  });
});

describe("each piece plugin a projection imports, whose shipped declaration names ESLint's own plugin type, type-checked in memory by the package build's own port", () => {
  it("is ESLint's own plugin type on ESLint 10 and its floor, for each piece whose rules are ESLint's own rule type", () => {
    expect(piecesEmitted).toMatchObject({ outcome: "ok", value: { diagnostics: [] } });
  });
});
