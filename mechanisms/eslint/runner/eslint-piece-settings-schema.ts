import { z } from "zod";
import { moduleFileForm } from "../../../core/values/install-layout.ts";
import { isRepoPathText } from "../../../core/values/repo-path.ts";

const pieceModulePathSchema = z.string().superRefine((text, context) => {
  if (isRepoPathText({ text }) === "not-repo-path" || moduleFileForm({ text }) === "not-module-file") {
    context.addIssue({
      code: "custom",
      message: "not a path inside the piece folder ending in .ts, or .js in a built install",
    });
  }
});

const pluginNamespaceSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);

export const eslintPieceSettingsSchema = z
  .strictObject({
    pluginNamespace: pluginNamespaceSchema,
    pluginModule: pieceModulePathSchema,
    rule: z.string(),
    options: z.array(z.json()).readonly().optional(),
  })
  .readonly();

export type EslintPieceSettings = z.infer<typeof eslintPieceSettingsSchema>;

export type RuleOptions = NonNullable<EslintPieceSettings["options"]>;

export const ruleOptionsOf = (request: { readonly settings: EslintPieceSettings }): RuleOptions =>
  request.settings.options ?? [];
