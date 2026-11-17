import { z } from "zod";
import { type AbsolutePath, isAbsolutePath, POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT } from "./absolute-path-types.ts";
import { brandedTextSchema } from "./branded-schema.ts";
import type { Equal } from "./type-equality.ts";

export type { AbsolutePath } from "./absolute-path-types.ts";

export const absolutePathSchema = brandedTextSchema({
  text: z.string().regex(POSIX_ROOT_DRIVE_ROOT_OR_SHARE_ROOT),
  isBranded: isAbsolutePath,
  refusal: "not an absolute path",
});

export const isAbsolutePathSchemaEqual: Equal<z.output<typeof absolutePathSchema>, AbsolutePath> = true;
