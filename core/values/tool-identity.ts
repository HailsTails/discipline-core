export type ToolIdentity = {
  readonly packageName: string;
  readonly command: string;
  readonly description: string;
};

export const TOOL_IDENTITY: ToolIdentity = {
  packageName: "honed",
  command: "hone",
  description: "Checks a repository against the coding disciplines it selects, applies its recorded exceptions and prints one verdict.",
};
