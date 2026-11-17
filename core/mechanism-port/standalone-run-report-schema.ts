import { z } from "zod";
import { inlineDisableSchema } from "./embedded-run-report-schema.ts";
import { hitSchema } from "./runner-result-schema.ts";

export const standaloneRunReportSchema = z
  .object({
    hits: z.array(hitSchema).readonly(),
    nativeExceptions: z.array(inlineDisableSchema).readonly(),
  })
  .readonly();

export type StandaloneRunReport = z.infer<typeof standaloneRunReportSchema>;
