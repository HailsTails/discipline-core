import { afterAll, assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { materialisedConsumerFixture, materialisedConsumersFolder, removedMaterialisedConsumers } from "./materialised-consumer.ts";

const OWNER = "materialised-consumer-test";

const fileText = createDefaultFileTextPort({});

afterAll(() => {
  expect(removedMaterialisedConsumers({ owner: OWNER })).toEqual({ outcome: "ok", value: null });
});

describe("materialisedConsumerFixture", () => {
  it("writes the audit consumer's files without their fixture suffix into the folder it returns", () => {
    const materialised = materialisedConsumerFixture({ owner: OWNER, fixture: "audit" });
    assert(materialised.outcome === "ok", "the audit consumer fixture materialises");

    expect({
      selection: fileText.exists({ path: `${materialised.value}/disciplines.json` }),
      template: fileText.exists({ path: `${materialised.value}/disciplines.json.fixture` }),
      unit: fileText.read({ path: `${materialised.value}/src/kept.ts` }),
    }).toEqual({ selection: "present", template: "absent", unit: { outcome: "ok", value: "export const kept = 1;\n" } });
  });

  it("fails for a fixture that does not exist", () => {
    expect(materialisedConsumerFixture({ owner: OWNER, fixture: "absent" }).outcome).toBe("failed");
  });
});

describe("removedMaterialisedConsumers", () => {
  it("removes the owner's materialised folder", () => {
    materialisedConsumerFixture({ owner: OWNER, fixture: "audit" });

    expect({
      removed: removedMaterialisedConsumers({ owner: OWNER }),
      folder: fileText.exists({ path: materialisedConsumersFolder({ owner: OWNER }) }),
    }).toEqual({ removed: { outcome: "ok", value: null }, folder: "absent" });
  });
});
