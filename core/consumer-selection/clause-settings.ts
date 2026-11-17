import { z } from "zod";
import { type ClauseAddress, clauseAddressSchema, clauseAddressText } from "../values/clause-address.ts";
import type { Result } from "../values/result.ts";

export const clauseSettingsSchema = z
  .record(z.string(), z.record(z.string(), z.json()))
  .transform((settings) => Object.entries(settings))
  .pipe(z.array(z.tuple([clauseAddressSchema, z.record(z.string(), z.json())])));

export type ClauseSettings = z.output<typeof clauseSettingsSchema>;

const declaredSettingsSchema = z.looseObject({ clauseSettings: z.record(z.string(), z.unknown()) });

const settingsNotTaken = (request: {
  readonly address: ClauseAddress;
  readonly detail: string;
}): Result<never, string> => ({
  outcome: "failed",
  error: `clauseSettings for ${clauseAddressText({ address: request.address })}: ${request.detail}`,
});

const undeclaredKeysOf = (request: {
  readonly declared: Readonly<Record<string, unknown>>;
  readonly given: Readonly<Record<string, unknown>>;
}): readonly string[] => Object.keys(request.given).filter((key) => !Object.hasOwn(request.declared, key));

export const settledPieceSettings = (request: {
  readonly address: ClauseAddress;
  readonly pieceSettings: unknown;
  readonly given: Readonly<Record<string, unknown>> | undefined;
}): Result<unknown, string> => {
  if (request.given === undefined) return { outcome: "ok", value: request.pieceSettings };
  const declared = declaredSettingsSchema.safeParse(request.pieceSettings);
  if (!declared.success || Object.keys(declared.data.clauseSettings).length === 0) {
    return settingsNotTaken({ address: request.address, detail: "its piece takes no settings" });
  }
  const undeclared = undeclaredKeysOf({ declared: declared.data.clauseSettings, given: request.given });
  if (undeclared.length > 0) {
    return settingsNotTaken({
      address: request.address,
      detail: `its piece takes no ${undeclared.join(", ")}; it takes ${Object.keys(declared.data.clauseSettings).join(", ")}`,
    });
  }
  return {
    outcome: "ok",
    value: { ...declared.data, clauseSettings: { ...declared.data.clauseSettings, ...request.given } },
  };
};
