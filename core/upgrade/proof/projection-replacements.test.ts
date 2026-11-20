import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../values/repo-path.ts";
import type { PlannedRepoFile } from "./planned-repo-file.ts";
import { replacementsOf } from "./projection-replacements.ts";
import type { VersionOneProjection } from "./team-config-finder.ts";

const path = (text: string) => repoPathSchema.parse(text);

const importing = (specifier: string): string => `import disciplines from "${specifier}";\nexport default [...disciplines];\n`;

const ROOT_VERSION_ONE: VersionOneProjection = {
  projection: path("disciplines.eslint.mjs"),
  teamConfig: { file: path("eslint.config.mjs"), text: importing("./disciplines.eslint.mjs") },
};

const SLICE_VERSION_ONE: VersionOneProjection = {
  projection: path("packages/a/disciplines.eslint.mjs"),
  teamConfig: { file: path("packages/a/eslint.config.mjs"), text: importing("./disciplines.eslint.mjs") },
};

const ROOT_VERSION_TWO: PlannedRepoFile = { file: path("hone.eslint.mjs"), text: "root projection" };

const SLICE_VERSION_TWO: PlannedRepoFile = { file: path("packages/a/hone.eslint.mjs"), text: "slice projection" };

describe("replacementsOf", () => {
  it("rewrites the config of the root projection to import the version 2 root projection", () => {
    expect(replacementsOf({ projections: [ROOT_VERSION_ONE], projected: [ROOT_VERSION_TWO] })).toEqual({
      outcome: "ok",
      value: [{ file: "eslint.config.mjs", text: importing("./hone.eslint.mjs") }],
    });
  });

  it("rewrites each slice's config to import the version 2 projection in the folder of that config", () => {
    expect(replacementsOf({ projections: [ROOT_VERSION_ONE, SLICE_VERSION_ONE], projected: [ROOT_VERSION_TWO, SLICE_VERSION_TWO] })).toEqual({
      outcome: "ok",
      value: [
        { file: "eslint.config.mjs", text: importing("./hone.eslint.mjs") },
        { file: "packages/a/eslint.config.mjs", text: importing("./hone.eslint.mjs") },
      ],
    });
  });

  it("pairs by the folder of the version 1 projection, pointing a config in another folder at it by a relative import", () => {
    const importedFromAbove: VersionOneProjection = {
      projection: path("disciplines.eslint.mjs"),
      teamConfig: { file: path("packages/a/eslint.config.mjs"), text: importing("../../disciplines.eslint.mjs") },
    };
    expect(replacementsOf({ projections: [importedFromAbove], projected: [ROOT_VERSION_TWO] })).toEqual({
      outcome: "ok",
      value: [{ file: "packages/a/eslint.config.mjs", text: importing("../../hone.eslint.mjs") }],
    });
  });

  it("rewrites a config that imports the root and a package projection, each to the version 2 projection of its own folder", () => {
    const rootConfig = { file: path("eslint.config.mjs"), text: `import root from "./disciplines.eslint.mjs";
import slice from "./packages/a/disciplines.eslint.mjs";
export default [...slice, ...root];
` };
    expect(
      replacementsOf({
        projections: [{ ...ROOT_VERSION_ONE, teamConfig: rootConfig }, { ...SLICE_VERSION_ONE, teamConfig: rootConfig }],
        projected: [ROOT_VERSION_TWO, SLICE_VERSION_TWO],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ file: "eslint.config.mjs", text: `import root from "./hone.eslint.mjs";
import slice from "./packages/a/hone.eslint.mjs";
export default [...slice, ...root];
` }],
    });
  });

  it("replaces nothing when version 1 wrote no projection and version 2 projects none", () => {
    expect(replacementsOf({ projections: [], projected: [] })).toEqual({ outcome: "ok", value: [] });
  });

  it("refuses a version 1 projection whose config has no version 2 projection in its folder", () => {
    expect(replacementsOf({ projections: [ROOT_VERSION_ONE, SLICE_VERSION_ONE], projected: [ROOT_VERSION_TWO] })).toEqual({
      outcome: "failed",
      error: {
        kind: "projections-unpaired",
        refusal: { kind: "version-one-projection-unpaired", projection: "packages/a/disciplines.eslint.mjs", config: "packages/a/eslint.config.mjs", folder: "packages/a" },
      },
    });
  });

  it("refuses a version 2 projection that no version 1 projection stands behind", () => {
    expect(replacementsOf({ projections: [ROOT_VERSION_ONE], projected: [ROOT_VERSION_TWO, SLICE_VERSION_TWO] })).toEqual({
      outcome: "failed",
      error: { kind: "projections-unpaired", refusal: { kind: "version-two-projection-unpaired", file: "packages/a/hone.eslint.mjs", folder: "packages/a" } },
    });
  });

  it("refuses a version 2 projection when version 1 wrote none", () => {
    expect(replacementsOf({ projections: [], projected: [ROOT_VERSION_TWO] })).toEqual({
      outcome: "failed",
      error: { kind: "projections-unpaired", refusal: { kind: "version-two-projection-unpaired", file: "hone.eslint.mjs", folder: "" } },
    });
  });

  it("refuses a config that names its projection outside the import", () => {
    const named: VersionOneProjection = {
      ...ROOT_VERSION_ONE,
      teamConfig: { file: path("eslint.config.mjs"), text: `${importing("./disciplines.eslint.mjs")}// disciplines.eslint.mjs\nconst other = "disciplines.eslint.mjs";\n` },
    };
    expect(replacementsOf({ projections: [named], projected: [ROOT_VERSION_TWO] })).toEqual({
      outcome: "failed",
      error: { kind: "config-import-refused", refusal: { kind: "projection-named-elsewhere", file: "eslint.config.mjs" } },
    });
  });
});
