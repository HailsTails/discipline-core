export type ToolIdentity = {
  readonly name: string;
  readonly packageName: string;
  readonly command: string;
  readonly reservedEslintNamespace: string;
  readonly description: string;
  readonly repository: string;
  readonly unrelatedNpmPackage: string;
};

export const TOOL_IDENTITY: ToolIdentity = {
  name: "Hone",
  packageName: "honed",
  command: "hone",
  reservedEslintNamespace: "honed",
  description: "Checks a repository against the disciplines it selects, applies its recorded exceptions and prints one verdict.",
  repository: "https://github.com/HailsTails/hone",
  unrelatedNpmPackage: "hone",
};
