import { z } from "zod";
import { brandedTextSchema } from "./branded-schema.ts";
import { isRepoPath, isRepoPathText, type RepoPath } from "./repo-path-types.ts";
import type { Equal } from "./type-equality.ts";

export type { RepoPath } from "./repo-path-types.ts";

const NOT_A_REPO_PATH = "not a repo-relative path";

export const repoPathSchema = brandedTextSchema({
  text: z.string().superRefine((text, context) => {
    if (isRepoPathText({ text }) === "not-repo-path") {
      context.addIssue({ code: "custom", message: NOT_A_REPO_PATH });
    }
  }),
  isBranded: isRepoPath,
  refusal: NOT_A_REPO_PATH,
});

export const isRepoPathSchemaEqual: Equal<z.output<typeof repoPathSchema>, RepoPath> = true;
