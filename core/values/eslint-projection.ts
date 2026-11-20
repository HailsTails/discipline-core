import { z } from "zod";

export const eslintProjectionSchema = z.enum(["javascript", "typescript"]);

export type EslintProjection = z.infer<typeof eslintProjectionSchema>;
