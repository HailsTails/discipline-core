import { describe, expect, it } from "vitest";
import { UPGRADE_LINES } from "./printable-upgrade-lines.ts";

describe("UPGRADE_LINES", () => {
  it("labels every line upgrade and opens with each header the command prints", () => {
    expect({
      labels: [...new Set(UPGRADE_LINES.map(({ label }) => label))],
      headers: ["upgrade refused:", "upgrade incomplete:", "upgraded to version 2", "already on version 2; nothing to upgrade"].map((header) => UPGRADE_LINES.some(({ text }) => text === header)),
    }).toEqual({ labels: ["upgrade"], headers: [true, true, true, true] });
  });
});
