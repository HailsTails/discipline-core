import { z } from "zod";
import { brandedTextSchema } from "./branded-schema.ts";
import { editionOrder } from "./edition-reach.ts";
import type { ClauseEditions, Edition } from "./edition-types.ts";
import type { Equal } from "./type-equality.ts";

export type { ClauseEditionReading, ClauseEditions, Edition, EditionReach } from "./edition-types.ts";
export { editionReaches } from "./edition-reach.ts";

const EDITION_PATTERN = /^[1-9][0-9]*$/;

const isEdition = (text: string): text is Edition => EDITION_PATTERN.test(text);

export const editionSchema = brandedTextSchema({
  text: z.string().regex(EDITION_PATTERN),
  isBranded: isEdition,
  refusal: "not an edition: a whole number from 1, written as text",
});

export const FIRST_EDITION: Edition = editionSchema.parse("1");

export const clauseEditionsSchema = z
  .tuple([editionSchema], editionSchema)
  .default([FIRST_EDITION])
  .refine((editions) => editionOrder({ editions }) === "ascending", { error: "editions must be listed in ascending order, each once" })
  .transform(([first, ...later]): ClauseEditions => ({ declared: [first, ...later], default: first, latest: later.at(-1) ?? first }));

export const isEditionSchemaEqual: Equal<z.output<typeof editionSchema>, Edition> = true;
export const isClauseEditionsSchemaEqual: Equal<z.output<typeof clauseEditionsSchema>, ClauseEditions> = true;
