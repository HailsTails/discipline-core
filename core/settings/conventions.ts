import { z } from "zod";
import { brandedRepoPathSchema, type RepoPath, repoPathTextSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";

export const CASINGS = ["kebab-case", "PascalCase", "camelCase", "UPPER_SNAKE_CASE"] as const;

export type Casing = (typeof CASINGS)[number];

export const CASING_TARGETS = [
  "fileNames",
  "variables",
  "constants",
  "functions",
  "parameters",
  "types",
  "enumMembers",
  "classMembers",
  "objectProperties",
  "typeProperties",
] as const;

export type CasingTarget = (typeof CASING_TARGETS)[number];

export type TargetCasing = { readonly target: CasingTarget; readonly allowed: readonly Casing[] };

export type CasingEntry = { readonly files: readonly string[]; readonly casings: readonly TargetCasing[] };

export type TestFiles = { readonly unit: readonly string[]; readonly integration: readonly string[] };

export type GeneratedFiles = { readonly files: readonly string[]; readonly outsideParty: string };

export type TrackedPointer =
  | { readonly form: "any-reference" }
  | { readonly form: "issue-number" }
  | { readonly form: "repository-issue" }
  | { readonly form: "link" }
  | { readonly form: "project-key"; readonly keys: readonly string[] };

export const LAYER_NAMES = ["domain", "application", "adapters"] as const;

export type LayerName = (typeof LAYER_NAMES)[number];

export type LayerFolders = { readonly layer: LayerName; readonly folders: readonly RepoPath[] };

export type Conventions = {
  readonly testFiles: TestFiles;
  readonly casing: readonly CasingEntry[];
  readonly generated: readonly GeneratedFiles[];
  readonly trackedPointers: readonly TrackedPointer[];
  readonly layers: readonly LayerFolders[];
};

export type ConventionKey = "testFiles" | "casing" | "generated" | "trackedPointers" | "layers";

export type ConventionsReading = { readonly conventions: Conventions; readonly declared: readonly ConventionKey[] };

export const DEFAULT_CONVENTIONS: Conventions = {
  testFiles: { unit: [".test.ts", ".test.tsx"], integration: [] },
  casing: [
    {
      files: ["**"],
      casings: [
        { target: "fileNames", allowed: ["kebab-case", "PascalCase"] },
        { target: "variables", allowed: ["camelCase", "PascalCase"] },
        { target: "constants", allowed: ["UPPER_SNAKE_CASE", "camelCase", "PascalCase"] },
        { target: "functions", allowed: ["camelCase", "PascalCase"] },
        { target: "parameters", allowed: ["camelCase", "PascalCase"] },
        { target: "types", allowed: ["PascalCase"] },
        { target: "enumMembers", allowed: ["UPPER_SNAKE_CASE"] },
        { target: "classMembers", allowed: ["camelCase"] },
        { target: "objectProperties", allowed: ["camelCase"] },
        { target: "typeProperties", allowed: ["camelCase", "PascalCase"] },
      ],
    },
  ],
  generated: [],
  trackedPointers: [{ form: "any-reference" }],
  layers: [],
};

const fileGlobsSchema = z.array(z.string().min(1)).min(1);

const generatedGlobsSchema = z
  .array(z.string().min(1).refine((glob) => !glob.startsWith("**"), { error: "a generated entry names files under a folder, not files anywhere" }))
  .min(1);

const casingsSchema =z.array(z.enum(CASINGS)).min(1).optional();

const casingEntryWireSchema = z
  .strictObject({
    files: fileGlobsSchema,
    fileNames: casingsSchema,
    variables: casingsSchema,
    constants: casingsSchema,
    functions: casingsSchema,
    parameters: casingsSchema,
    types: casingsSchema,
    enumMembers: casingsSchema,
    classMembers: casingsSchema,
    objectProperties: casingsSchema,
    typeProperties: casingsSchema,
  })
  .refine((entry) => CASING_TARGETS.some((target) => entry[target] !== undefined), {
    error: `a casing entry sets at least one of ${CASING_TARGETS.join(", ")}`,
  });

type CasingEntryWire = z.infer<typeof casingEntryWireSchema>;

const testFileSuffixSchema = z
  .string()
  .refine((suffix) => suffix.startsWith(".") && !suffix.includes("/") && !suffix.includes("*"), {
    error: "a test file suffix starts with a dot and holds no slash or star",
  });

const testFilesWireSchema = z
  .strictObject({ unit: z.array(testFileSuffixSchema).min(1), integration: z.array(testFileSuffixSchema) })
  .superRefine((testFiles, context) => {
    testFiles.integration
      .filter((suffix) => testFiles.unit.includes(suffix))
      .forEach((suffix) => {
        context.addIssue({ code: "custom", message: `${suffix} is both a unit and an integration test suffix` });
      });
  });

const projectKeySchema = z.string().refine((key) => /^[A-Z][A-Z0-9]*$/.test(key), {
  error: "a project key is upper-case letters and digits, starting with a letter",
});

const trackedPointerWireSchema = z.discriminatedUnion("form", [
  z.strictObject({ form: z.literal("any-reference") }),
  z.strictObject({ form: z.literal("issue-number") }),
  z.strictObject({ form: z.literal("repository-issue") }),
  z.strictObject({ form: z.literal("link") }),
  z.strictObject({ form: z.literal("project-key"), keys: z.array(projectKeySchema).min(1) }),
]);

type TrackedPointerWire = z.infer<typeof trackedPointerWireSchema>;

const conventionsWireSchema = z.strictObject({
  testFiles: testFilesWireSchema.optional(),
  casing: z.array(casingEntryWireSchema).min(1).optional(),
  generated: z.array(z.strictObject({ files: generatedGlobsSchema, outsideParty: z.string().min(1) })).optional(),
  trackedPointers: z.array(trackedPointerWireSchema).min(1).optional(),
});

const layerFolderSchema = brandedRepoPathSchema({
  text: repoPathTextSchema.refine((folder) => !folder.includes("*"), { error: "a layer lists folders git tracks, not globs" }),
});

const layerFoldersSchema = z.array(layerFolderSchema).min(1).optional();

const isInside = (request: { readonly folder: string; readonly outer: string }): "inside" | "apart" =>
  request.folder !== request.outer && request.folder.startsWith(`${request.outer}/`) ? "inside" : "apart";

const layersWireSchema = z
  .strictObject({ domain: layerFoldersSchema, application: layerFoldersSchema, adapters: layerFoldersSchema })
  .superRefine((layers, context) => {
    const folders = LAYER_NAMES.flatMap((layer) => layers[layer] ?? []);
    folders.forEach((folder) => {
      folders
        .filter((outer) => isInside({ folder, outer }) === "inside")
        .forEach((outer) => {
          context.addIssue({ code: "custom", message: `${folder} is inside ${outer}; no layer folder sits inside another` });
        });
    });
  });

const conventionsDocumentSchema = z.strictObject({ conventions: conventionsWireSchema, layers: layersWireSchema });

type ConventionsDocument = z.infer<typeof conventionsDocumentSchema>;

const casingEntryOf = (wire: CasingEntryWire): CasingEntry => ({
  files: wire.files,
  casings: CASING_TARGETS.flatMap((target): readonly TargetCasing[] => {
    const allowed = wire[target];
    return allowed === undefined ? [] : [{ target, allowed }];
  }),
});

const trackedPointerOf = (wire: TrackedPointerWire): TrackedPointer =>
  wire.form === "project-key" ? { form: "project-key", keys: wire.keys } : { form: wire.form };

const layersOf = (request: { readonly layers: ConventionsDocument["layers"] }): readonly LayerFolders[] =>
  LAYER_NAMES.flatMap((layer): readonly LayerFolders[] => {
    const folders = request.layers[layer];
    return folders === undefined ? [] : [{ layer, folders }];
  });

const declaredKeysOf = (request: { readonly document: ConventionsDocument; readonly layers: readonly LayerFolders[] }): readonly ConventionKey[] => [
  ...(request.document.conventions.testFiles === undefined ? [] : ["testFiles" as const]),
  ...(request.document.conventions.casing === undefined ? [] : ["casing" as const]),
  ...(request.document.conventions.generated === undefined ? [] : ["generated" as const]),
  ...(request.document.conventions.trackedPointers === undefined ? [] : ["trackedPointers" as const]),
  ...(request.layers.length === 0 ? [] : ["layers" as const]),
];

const conventionsReadingOf = (request: { readonly document: ConventionsDocument }): ConventionsReading => {
  const { conventions } = request.document;
  const layers = layersOf({ layers: request.document.layers });
  return {
    conventions: {
      testFiles:
        conventions.testFiles === undefined
          ? DEFAULT_CONVENTIONS.testFiles
          : { unit: conventions.testFiles.unit, integration: conventions.testFiles.integration },
      casing: conventions.casing === undefined ? DEFAULT_CONVENTIONS.casing : conventions.casing.map(casingEntryOf),
      generated:
        conventions.generated === undefined
          ? DEFAULT_CONVENTIONS.generated
          : conventions.generated.map((entry) => ({ files: entry.files, outsideParty: entry.outsideParty })),
      trackedPointers: conventions.trackedPointers === undefined ? DEFAULT_CONVENTIONS.trackedPointers : conventions.trackedPointers.map(trackedPointerOf),
      layers,
    },
    declared: declaredKeysOf({ document: request.document, layers }),
  };
};

export const conventionsOf = (request: { readonly document: unknown }): Result<ConventionsReading, string> => {
  const parsed = conventionsDocumentSchema.safeParse(request.document);
  return parsed.success ? { outcome: "ok", value: conventionsReadingOf({ document: parsed.data }) } : { outcome: "failed", error: z.prettifyError(parsed.error) };
};
