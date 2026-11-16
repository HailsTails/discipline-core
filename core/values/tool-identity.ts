export type ToolIdentity = {
  readonly name: string;
  readonly packageName: string;
  readonly command: string;
  readonly reservedEslintNamespace: string;
  readonly description: string;
};

export const TOOL_IDENTITY: ToolIdentity = {
  name: "Hone",
  packageName: "honed",
  command: "hone",
  reservedEslintNamespace: "honed",
  description: "Checks a repository against the coding disciplines it selects, applies its recorded exceptions and prints one verdict.",
};
