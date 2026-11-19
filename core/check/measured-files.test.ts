import { describe, expect, it } from "vitest";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { measuredFilesOf } from "./measured-files.ts";

const ESLINT = mechanismIdSchema.parse("eslint");
const BASKET = repoPathSchema.parse("src/basket.ts");
const WEB_PAGE = repoPathSchema.parse("packages/web/page.ts");
const API_ROUTE = repoPathSchema.parse("packages/api/route.ts");
const WEBKIT_SHIM = repoPathSchema.parse("packages/webkit/shim.ts");

const CHECKED = [BASKET, WEB_PAGE, API_ROUTE, WEBKIT_SHIM];

const PLAIN_RUN = { mechanism: ESLINT, projection: "current", slices: [], unprojectedFolders: [] } as const;

describe("measuredFilesOf a run whose projection held", () => {
  it.each(["none", "current"] as const)("measures every checked file of a run whose projection is %s", (projection) => {
    expect(measuredFilesOf({ run: { ...PLAIN_RUN, projection }, checkedFiles: CHECKED })).toEqual({ mechanism: ESLINT, files: CHECKED });
  });

  it("measures no file under a folder whose slice has a problem or under an unprojected folder, keeping a folder that only shares a name prefix", () => {
    expect(
      measuredFilesOf({
        run: {
          ...PLAIN_RUN,
          slices: [{ slice: repoPathSchema.parse("packages/web/disciplines.eslint.mjs"), state: "nested-configuration" }],
          unprojectedFolders: [{ folder: repoPathSchema.parse("packages/api"), selectionFolder: repoPathSchema.parse("packages/api") }],
        },
        checkedFiles: CHECKED,
      }),
    ).toEqual({ mechanism: ESLINT, files: [BASKET, WEBKIT_SHIM] });
  });

  it("measures no file when the repository's own slice has a problem", () => {
    expect(
      measuredFilesOf({
        run: { ...PLAIN_RUN, slices: [{ slice: repoPathSchema.parse("disciplines.eslint.mjs"), state: "out-of-date" }] },
        checkedFiles: CHECKED,
      }),
    ).toEqual({ mechanism: ESLINT, files: [] });
  });
});

describe("measuredFilesOf a run whose projection did not hold", () => {
  it.each(["out-of-date", "missing", "not-included"] as const)("measures no file when the projection is %s", (projection) => {
    expect(measuredFilesOf({ run: { ...PLAIN_RUN, projection }, checkedFiles: CHECKED })).toEqual({ mechanism: ESLINT, files: [] });
  });
});
