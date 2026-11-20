import hone from "@hailstails/hone/eslint-plugin";
import type { Linter } from "eslint";
import { defineConfig } from "eslint/config";
import projection from "../disciplines.eslint.mts";

export const helped = defineConfig([...projection, { files: ["**/*.ts"], plugins: { hone } }]);

export const typed: Linter.Config[] = [...projection, { files: ["**/*.ts"], plugins: { hone } }];
