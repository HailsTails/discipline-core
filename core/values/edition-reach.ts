import type { Edition, EditionReach } from "./edition-types.ts";

const ordinalOf = (request: { readonly edition: Edition }): number => Number(request.edition);

export const editionReaches = (request: { readonly edition: Edition; readonly introducedIn: Edition }): EditionReach =>
  ordinalOf({ edition: request.edition }) >= ordinalOf({ edition: request.introducedIn }) ? "reached" : "not-reached";

export const editionOrder = (request: { readonly editions: readonly Edition[] }): "ascending" | "unordered" =>
  request.editions.every((edition, index) =>
    request.editions.slice(0, index).every((earlier) => ordinalOf({ edition: earlier }) < ordinalOf({ edition })),
  )
    ? "ascending"
    : "unordered";
