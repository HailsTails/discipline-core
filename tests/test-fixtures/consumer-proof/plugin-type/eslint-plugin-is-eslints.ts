import type { ESLint, Linter } from "eslint";
import hone from "../../../../api/eslint-plugin.ts";

export const plugin: ESLint.Plugin = hone;

export const configs: Linter.Config[] = [{ plugins: { hone } }];
