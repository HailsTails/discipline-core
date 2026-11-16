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
  packageName: "@hailstails/hone",
  command: "hone",
  reservedEslintNamespace: "honed",
  description: "Checks a repository against the disciplines it selects, applies its recorded exceptions and prints one verdict.",
  repository: "https://github.com/HailsTails/hone",
  unrelatedNpmPackage: "hone",
};

const SCOPE_MARKER = "@";

const SCOPE_SEPARATOR = "/";

const FILE_STEM_SEPARATOR = "-";

export const packageFileStemOf = (request: { readonly packageName: string }): string => {
  const unscoped = request.packageName.startsWith(SCOPE_MARKER) ? request.packageName.slice(SCOPE_MARKER.length) : request.packageName;
  return unscoped.replace(SCOPE_SEPARATOR, FILE_STEM_SEPARATOR);
};
