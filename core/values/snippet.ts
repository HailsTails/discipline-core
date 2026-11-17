import { z } from "zod";

export const SNIPPET_LIMIT = 200;

const CUT_MARK = "…";

export const snippetSchema = z
  .string()
  .transform((text) => (text.length > SNIPPET_LIMIT ? `${text.slice(0, SNIPPET_LIMIT)}${CUT_MARK}` : text));
