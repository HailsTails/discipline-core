import { installedEslintBoundary } from "../mechanisms/eslint/runner/eslint-toolchain.ts";

const installed = await installedEslintBoundary();

if (installed.outcome === "failed") {
  throw new Error(installed.error);
}

export const INSTALLED_DECLARATION_TEXT: string = installed.value.declarationText;
