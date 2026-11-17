import { RuleTester } from "eslint";
import { noConsoleCalls } from "./acme.eslint-plugin.ts";

new RuleTester().run("no-console-calls", noConsoleCalls, {
  valid: ["export const greeting = 'hi';"],
  invalid: [{ code: "console.log(1);", errors: [{ messageId: "console" }] }],
});
