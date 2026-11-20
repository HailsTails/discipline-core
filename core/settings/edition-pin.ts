import type { ClauseSettingValues } from "../mechanism-port/runner-module-types.ts";
import { RESERVED_EDITION_SETTING } from "../rule-set-reader/rule-set-reader.ts";
import type { ReadonlyJsonValue } from "../values/json-value.ts";

export type EditionPin = {
  readonly pin: ReadonlyJsonValue | undefined;
  readonly rest: ClauseSettingValues | undefined;
};

export const editionPinOf = (request: { readonly given: ClauseSettingValues | undefined }): EditionPin => {
  if (request.given === undefined || !Object.hasOwn(request.given, RESERVED_EDITION_SETTING)) {
    return { pin: undefined, rest: request.given };
  }
  const { [RESERVED_EDITION_SETTING]: pin, ...rest } = request.given;
  return { pin, rest: Object.keys(rest).length === 0 ? undefined : rest };
};
