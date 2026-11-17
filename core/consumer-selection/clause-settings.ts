import { z } from "zod";
import type { ClauseSettingValues } from "../mechanism-port/runner-module-types.ts";
import type { ClauseSettingDeclaration, ClauseSettingDeclarations } from "../rule-set-reader/rule-set-reader.ts";
import { type ClauseAddress, clauseAddressSchema, clauseAddressText } from "../values/clause-address.ts";
import { type JsonKind, jsonKindOf, sameJsonValue } from "../values/json-kind.ts";
import type { ReadonlyJsonValue } from "../values/json-value.ts";
import type { Result } from "../values/result.ts";

export const clauseSettingsSchema = z
  .record(z.string(), z.record(z.string(), z.json()))
  .transform((settings) => Object.entries(settings))
  .pipe(z.array(z.tuple([clauseAddressSchema, z.record(z.string(), z.json())])));

export type ClauseSettings = z.output<typeof clauseSettingsSchema>;

const KIND_NAMES: Readonly<Record<JsonKind, string>> = {
  string: "a string",
  number: "a number",
  boolean: "a boolean",
  null: "null",
  array: "an array",
  object: "an object",
};

type GivenSetting = { readonly key: string; readonly value: ReadonlyJsonValue };

const refusal = (request: { readonly address: ClauseAddress; readonly detail: string }): Result<never, string> => ({
  outcome: "failed",
  error: `clauseSettings for ${clauseAddressText({ address: request.address })}: ${request.detail}`,
});

export const defaultClauseSettings = (request: { readonly declarations: ClauseSettingDeclarations }): ClauseSettingValues =>
  Object.fromEntries(Object.entries(request.declarations).map(([key, declaration]) => [key, declaration.default]));

const listed = (request: { readonly values: readonly ReadonlyJsonValue[] }): string =>
  request.values.map((choice) => JSON.stringify(choice)).join(", ");

const settingRefusalOf = (request: {
  readonly given: GivenSetting;
  readonly declaration: ClauseSettingDeclaration | undefined;
  readonly declarations: ClauseSettingDeclarations;
}): string | undefined => {
  const { given, declaration } = request;
  if (declaration === undefined) {
    return `its piece takes no ${given.key}; it takes ${Object.keys(request.declarations).join(", ")}`;
  }
  const kind = jsonKindOf({ value: declaration.default });
  if (jsonKindOf({ value: given.value }) !== kind) return `${given.key} must be ${KIND_NAMES[kind]}, as its default is`;
  const choices = declaration.choices;
  if (choices !== undefined && !choices.some((choice) => sameJsonValue({ left: choice, right: given.value }) === "same")) {
    return `${given.key} must be one of ${listed({ values: choices })}`;
  }
  return undefined;
};

export const settledClauseSettings = (request: {
  readonly address: ClauseAddress;
  readonly declarations: ClauseSettingDeclarations;
  readonly given: ClauseSettingValues | undefined;
}): Result<ClauseSettingValues, string> => {
  const defaults = defaultClauseSettings(request);
  if (request.given === undefined) return { outcome: "ok", value: defaults };
  if (Object.keys(request.declarations).length === 0) return refusal({ address: request.address, detail: "its piece takes no settings" });
  const detail = Object.entries(request.given)
    .map(([key, settingValue]) =>
      settingRefusalOf({
        given: { key, value: settingValue },
        declaration: Object.hasOwn(request.declarations, key) ? request.declarations[key] : undefined,
        declarations: request.declarations,
      }),
    )
    .find((found) => found !== undefined);
  if (detail !== undefined) return refusal({ address: request.address, detail });
  return { outcome: "ok", value: { ...defaults, ...request.given } };
};
