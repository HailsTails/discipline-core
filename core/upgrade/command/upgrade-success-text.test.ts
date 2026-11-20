import { describe, expect, it } from "vitest";
import { createPathPort } from "../../platform-ports/path-port.ts";
import { absolutePathSchema } from "../../values/absolute-path.ts";
import { repoPathSchema } from "../../values/repo-path.ts";
import { upgradeSuccessOutcomeOf } from "./upgrade-success-text.ts";

const REPO = absolutePathSchema.parse("/repo");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("upgradeSuccessOutcomeOf", () => {
  it("lists what was written, what was rewritten and what was removed, relative to the repository", () => {
    expect(
      upgradeSuccessOutcomeOf({
        repoRoot: REPO,
        path: PATH,
        carried: {
          written: [repoPathSchema.parse("hone.config.json"), repoPathSchema.parse("hone-records/debt/loop-keyword.json")],
          replaced: [repoPathSchema.parse("eslint.config.mjs"), repoPathSchema.parse("packages/a/eslint.config.mjs")],
          removed: {
            files: [absolutePathSchema.parse("/repo/discipline-exceptions/cd-15.json"), absolutePathSchema.parse("/repo/disciplines.json")],
            folders: [absolutePathSchema.parse("/repo/discipline-exceptions")],
          },
        },
      }),
    ).toEqual({
      code: 0,
      text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/loop-keyword.json\nrewrote eslint.config.mjs\nrewrote packages/a/eslint.config.mjs\nremoved discipline-exceptions/cd-15.json\nremoved disciplines.json\nremoved discipline-exceptions\n",
    });
  });

  it("names no rewrite when the repository had no team config", () => {
    expect(
      upgradeSuccessOutcomeOf({
        repoRoot: REPO,
        path: PATH,
        carried: { written: [repoPathSchema.parse("hone.config.json")], replaced: [], removed: { files: [absolutePathSchema.parse("/repo/disciplines.json")], folders: [] } },
      }),
    ).toEqual({ code: 0, text: "upgraded to version 2\nwrote hone.config.json\nremoved disciplines.json\n" });
  });
});
