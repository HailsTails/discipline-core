import { describe, expect, it } from "vitest";
import { PUBLIC_TYPE_ENTRIES } from "../scripts/package-declarations.ts";
import { createDefaultTypeScriptDeclarationPort } from "../scripts/typescript-declaration-port.ts";
import { publicTypeReachOf } from "./public-type-reach.ts";

const ENTRY_SOURCES = ["api/audit.ts", "api/rule-set.ts"];

const reach = publicTypeReachOf({
  emitted: await createDefaultTypeScriptDeclarationPort({}).emit({ sourceRoot: `${import.meta.dirname}/..`, entryPoints: ENTRY_SOURCES }),
  entries: PUBLIC_TYPE_ENTRIES,
  requiredPeers: ["typescript"],
});

describe("the declarations the public type entries ship, emitted in memory by the package build's own port (CD-47: nothing is spawned or written)", () => {
  it("emit both entries with no diagnostic and publish every declaration they reach", () => {
    expect(reach.problems).toEqual([]);
  });

  it("import no package but typescript from the audit entry, and none at all from the rule-set entry", () => {
    expect(reach.entries).toMatchObject({ audit: { packageImports: ["typescript"] }, "rule-set": { packageImports: [] } });
  });

  it("reach no internal port, toolchain or tool identity from the audit entry", () => {
    expect(reach.entries).toMatchObject({
      audit: {
        reached: expect.not.arrayContaining([
          expect.stringMatching(
            /^core\/(?:mechanism-port\/(?:toolchain-requirement|runner-failure)|platform-ports\/package-location-port|values\/install-layout|values\/tool-identity)\.d\.ts$/,
          ),
        ]),
      },
    });
  });

  it("ship no declaration that claims an exported value", () => {
    expect(reach.valueDeclaring).toEqual([]);
  });

  it("ship no declaration that mentions zod", () => {
    expect(reach.zodMentioning).toEqual([]);
  });
});
