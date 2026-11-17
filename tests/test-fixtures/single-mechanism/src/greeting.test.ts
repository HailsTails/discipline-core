import { expect, it } from "vitest";
import { renderGreeting } from "./greeting.ts";

it("greets the visitor by name", () => {
  expect(renderGreeting("Ada")).toBe("Hello, Ada");
});
