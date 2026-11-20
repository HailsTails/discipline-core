import { z } from "zod";
import type { ClauseSettingValues } from "../mechanism-port/runner-module-types.ts";
import { type ForfeitureAssessment, forfeitureAssessmentSchema } from "../values/assessment.ts";
import { type CheckEditions, checkEditionsSchema } from "../values/check-editions.ts";
import { TOOL_RULE_SET } from "../values/clause-address.ts";
import { type EslintConfigLookup, eslintConfigLookupSchema } from "../values/eslint-config-lookup.ts";
import { NOT_ADOPTED, NOT_RUN, type RuleSetName, ruleSetNameSchema } from "../values/identifiers.ts";
import { brandedRepoPathSchema, type RepoPath, repoPathSchema, repoPathTextSchema } from "../values/repo-path.ts";
import { type ReportOutput, reportOutputSchema } from "../values/report-output.ts";
import type { Result } from "../values/result.ts";
import { type ConventionsReading, conventionsOf } from "./conventions.ts";
import { type ListedAddress, listedAddressSchema } from "./listed-address.ts";

export type RuleSetLocation = { readonly location: "repo-root" } | { readonly location: "folder"; readonly path: RepoPath };

export type DeclaredRuleSet = { readonly name: RuleSetName; readonly location: RuleSetLocation };

export type CheckState = { readonly state: "run"; readonly engine: string } | { readonly state: "not-run" } | { readonly state: "not-adopted" };

export type ListedCheck = { readonly address: ListedAddress; readonly state: CheckState };

export type GivenCheckSettings = { readonly address: ListedAddress; readonly values: ClauseSettingValues };

export type EslintConfigLookupChoice = { readonly lookup: "detected" } | { readonly lookup: "declared"; readonly value: EslintConfigLookup };

export type SettingsFile = {
  readonly exclude: readonly RepoPath[];
  readonly ruleSets: readonly DeclaredRuleSet[];
  readonly checks: readonly ListedCheck[];
  readonly checkSettings: readonly GivenCheckSettings[];
  readonly forfeiture: ForfeitureAssessment;
  readonly reportOutput: ReportOutput;
  readonly checkEditions: CheckEditions;
  readonly eslintConfigLookup: EslintConfigLookupChoice;
  readonly eslintConfigRoots: readonly RepoPath[];
  readonly conventions: ConventionsReading;
};

export type SettingsFileFault =
  | { readonly kind: "malformed"; readonly detail: string }
  | { readonly kind: "reserved-rule-set-name"; readonly name: string }
  | { readonly kind: "rule-set-name-collision"; readonly name: string; readonly other: string };

export const RENAMED_SETTINGS = [{ name: "confinedOutsideDependencies", pieceName: "confinedPackages" }] as const;

const RULE_SET_SUFFIX_SEPARATOR = "-";

const LEADING_CURRENT_DIRECTORY = "./";

const ENGINE_NAME_TEXT = /^[a-z][a-z0-9-]*$/;

const retiredKeySchema = (request: { readonly refusal: string }) => z.never({ error: request.refusal }).optional();

const ruleSetLocationSchema = z.union([
  z.enum([".", LEADING_CURRENT_DIRECTORY]).transform((): RuleSetLocation => ({ location: "repo-root" })),
  z
    .string()
    .transform((text) => (text.startsWith(LEADING_CURRENT_DIRECTORY) ? text.slice(LEADING_CURRENT_DIRECTORY.length) : text))
    .pipe(repoPathSchema)
    .transform((path): RuleSetLocation => ({ location: "folder", path })),
]);

const checkStateSchema = z.union(
  [
    z.literal(NOT_RUN).transform((): CheckState => ({ state: "not-run" })),
    z.literal(NOT_ADOPTED).transform((): CheckState => ({ state: "not-adopted" })),
    z
      .string()
      .regex(ENGINE_NAME_TEXT)
      .transform((engine): CheckState => ({ state: "run", engine })),
  ],
  { error: `a check takes an engine, "${NOT_RUN}" or "${NOT_ADOPTED}"` },
);


const settingValuesSchema = z.record(z.string(), z.json()).superRefine((values, context) => {
  RENAMED_SETTINGS.filter(({ pieceName }) => Object.hasOwn(values, pieceName)).forEach(({ name, pieceName }) => {
    context.addIssue({ code: "custom", path: [pieceName], message: `renamed: "${pieceName}" is "${name}" in version 2` });
  });

});

const folderListSchema = (request: { readonly refusal: string }) =>
  z
    .array(brandedRepoPathSchema({ text: repoPathTextSchema.refine((folder) => !folder.includes("*"), { error: request.refusal }) }))
    .default([]);

const settingsFileWireSchema = z.strictObject({
  version: z.literal(2),
  exclude: folderListSchema({ refusal: "an exclude entry is a repository path, not a glob" }),
  ruleSets: z
    .record(ruleSetNameSchema, z.string())
    .transform((ruleSets) => Object.entries(ruleSets))
    .pipe(z.array(z.tuple([ruleSetNameSchema, ruleSetLocationSchema]))),
  checks: z
    .record(z.string(), z.string())
    .transform((checks) => Object.entries(checks))
    .pipe(z.array(z.tuple([listedAddressSchema, checkStateSchema]))),
  checkSettings: z
    .record(z.string(), settingValuesSchema)
    .transform((settings) => Object.entries(settings))
    .pipe(z.array(z.tuple([listedAddressSchema, z.record(z.string(), z.json())])))
    .default([]),
  forfeiture: forfeitureAssessmentSchema.default("this-run"),
  reportOutput: reportOutputSchema.default("full"),
  checkEditions: checkEditionsSchema.default("pinned"),
  eslintConfigLookup: eslintConfigLookupSchema.optional(),
  eslintConfigRoots: folderListSchema({ refusal: "an eslintConfigRoots entry is a repository folder, not a glob" }),
  conventions: z.unknown().optional(),
  layers: z.unknown().optional(),
  clauses: retiredKeySchema({ refusal: 'renamed: "clauses" is "checks" in version 2, addressed <symptom>#<check>' }),
  clauseSettings: retiredKeySchema({ refusal: 'renamed: "clauseSettings" is "checkSettings" in version 2, addressed <symptom>#<check>' }),
  assessment: retiredKeySchema({ refusal: 'renamed: "assessment" is "forfeiture" in version 2, at the top level' }),
  fileExceptionWhyChains: retiredKeySchema({ refusal: 'removed: "fileExceptionWhyChains"; every record shows its why-chain in version 2' }),
});

type SettingsFileWire = z.infer<typeof settingsFileWireSchema>;

const ruleSetFaultOf = (request: { readonly ruleSets: readonly DeclaredRuleSet[] }): SettingsFileFault | undefined => {
  const names: readonly string[] = request.ruleSets.map(({ name }) => name);
  const reserved = names.find((name) => name === TOOL_RULE_SET || name.startsWith(`${TOOL_RULE_SET}${RULE_SET_SUFFIX_SEPARATOR}`));
  if (reserved !== undefined) {
    return { kind: "reserved-rule-set-name", name: reserved };
  }
  const collisions = names.flatMap((name) =>
    names
      .filter((other) => other.startsWith(`${name}${RULE_SET_SUFFIX_SEPARATOR}`))
      .map((other): SettingsFileFault => ({ kind: "rule-set-name-collision", name, other })),
  );
  return collisions[0];
};

export const eslintConfigLookupOf = (request: { readonly declared: EslintConfigLookup | undefined }): EslintConfigLookupChoice =>
  request.declared === undefined ? { lookup: "detected" } : { lookup: "declared", value: request.declared };

const settingsFileOfWire = (request: { readonly wire: SettingsFileWire; readonly conventions: ConventionsReading }): SettingsFile => ({
  exclude: request.wire.exclude,
  ruleSets: request.wire.ruleSets.map(([name, location]) => ({ name, location })),
  checks: request.wire.checks.map(([address, state]) => ({ address, state })),
  checkSettings: request.wire.checkSettings.map(([address, values]) => ({ address, values })),
  forfeiture: request.wire.forfeiture,
  reportOutput: request.wire.reportOutput,
  checkEditions: request.wire.checkEditions,
  eslintConfigLookup: eslintConfigLookupOf({ declared: request.wire.eslintConfigLookup }),
  eslintConfigRoots: request.wire.eslintConfigRoots,
  conventions: request.conventions,
});

export const settingsFileOf = (request: { readonly document: unknown }): Result<SettingsFile, SettingsFileFault> => {
  const parsed = settingsFileWireSchema.safeParse(request.document);
  if (!parsed.success) {
    return { outcome: "failed", error: { kind: "malformed", detail: z.prettifyError(parsed.error) } };
  }
  const conventions = conventionsOf({ document: { conventions: parsed.data.conventions ?? {}, layers: parsed.data.layers ?? {} } });
  if (conventions.outcome === "failed") {
    return { outcome: "failed", error: { kind: "malformed", detail: conventions.error } };
  }
  const file = settingsFileOfWire({ wire: parsed.data, conventions: conventions.value });
  const fault = ruleSetFaultOf({ ruleSets: file.ruleSets });
  return fault === undefined ? { outcome: "ok", value: file } : { outcome: "failed", error: fault };
};
