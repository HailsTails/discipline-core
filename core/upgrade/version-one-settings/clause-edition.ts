import { RESERVED_EDITION_SETTING } from "../../rule-set-reader/rule-set-reader.ts";
import type { CheckEditions } from "../../values/check-editions.ts";
import { type ClauseAddress, clauseAddressText } from "../../values/clause-address.ts";
import type { ClauseEditions, Edition } from "../../values/edition.ts";
import type { ReadonlyJsonValue } from "../../values/json-value.ts";
import type { Result } from "../../values/result.ts";

const UNPINNED_EDITIONS: Readonly<Record<CheckEditions, (editions: ClauseEditions) => Edition>> = {
  pinned: (editions) => editions.default,
  latest: (editions) => editions.latest,
};

export const settledClauseEdition = (request: {
  readonly address: ClauseAddress;
  readonly editions: ClauseEditions;
  readonly pin: ReadonlyJsonValue | undefined;
  readonly checkEditions: CheckEditions;
}): Result<Edition, string> => {
  if (request.pin === undefined) {
    return { outcome: "ok", value: UNPINNED_EDITIONS[request.checkEditions](request.editions) };
  }
  const pinned = request.editions.declared.find((edition) => edition === request.pin);
  if (pinned !== undefined) {
    return { outcome: "ok", value: pinned };
  }
  return {
    outcome: "failed",
    error: `clauseSettings for ${clauseAddressText({ address: request.address })}: ${RESERVED_EDITION_SETTING} must be one of ${request.editions.declared.map((edition) => JSON.stringify(edition)).join(", ")}`,
  };
};
