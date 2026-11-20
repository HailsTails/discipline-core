import { describe, expect, it } from "vitest";
import { UPGRADE_LINES } from "./printable-upgrade-lines.ts";

describe("UPGRADE_LINES", () => {
  it.each(["upgrade refused:", "upgrade incomplete:", "upgraded to version 2", "already on version 2; nothing to upgrade"])("holds the line %s, labelled upgrade", (text) => {
    expect(UPGRADE_LINES).toContainEqual(expect.objectContaining({ label: "upgrade", text }));
  });
});
