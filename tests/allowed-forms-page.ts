export type AllowedFormSection = {
  readonly heading: string;
  readonly section: string;
  readonly flagged: string;
  readonly allowed: readonly string[];
};

const PART_HEADING = "## Allowed forms in a test\n";

const TYPESCRIPT_BLOCK = /^```ts\n([\s\S]*?)^```$/gm;

export const sectionSlugOf = (request: { readonly heading: string }): string =>
  request.heading.toLowerCase().replaceAll(/[^a-z0-9 -]/g, "").trim().replaceAll(" ", "-");

const partOf = (request: { readonly page: string }): string => {
  const start = request.page.indexOf(PART_HEADING);
  if (start === -1) return "";
  const afterHeading = request.page.slice(start + PART_HEADING.length);
  const nextPart = afterHeading.search(/^## /m);
  return nextPart === -1 ? afterHeading : afterHeading.slice(0, nextPart);
};

const blocksOf = (request: { readonly chunk: string }): readonly string[] =>
  [...request.chunk.matchAll(TYPESCRIPT_BLOCK)].flatMap((block) => (block[1] === undefined ? [] : [block[1]]));

const sectionOf = (request: { readonly chunk: string }): readonly AllowedFormSection[] => {
  const heading = request.chunk.slice(0, request.chunk.indexOf("\n")).trim();
  const [flagged, ...allowed] = blocksOf(request);
  return flagged === undefined ? [] : [{ heading, section: sectionSlugOf({ heading }), flagged, allowed }];
};

export const allowedFormSectionsOf = (request: { readonly page: string }): readonly AllowedFormSection[] =>
  partOf({ page: request.page.replaceAll("\r\n", "\n") })
    .split(/^### /m)
    .slice(1)
    .flatMap((chunk) => sectionOf({ chunk }));
