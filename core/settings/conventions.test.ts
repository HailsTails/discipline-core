import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../values/repo-path.ts";
import { type ConventionsReading, conventionsOf, DEFAULT_CONVENTIONS } from "./conventions.ts";

describe("DEFAULT_CONVENTIONS", () => {
  it("holds today's hard-coded behaviour: test files by .test.ts and .test.tsx, files in kebab-case or PascalCase, CD-6's identifier casings, any parenthesised reference with a digit, no generated folders and no layers", () => {
    expect(DEFAULT_CONVENTIONS).toEqual({
      testFiles: { unit: [".test.ts", ".test.tsx"], integration: [] },
      casing: [
        {
          files: ["**"],
          casings: [
            { target: "fileNames", allowed: ["kebab-case", "PascalCase"] },
            { target: "variables", allowed: ["camelCase", "PascalCase"] },
            { target: "constants", allowed: ["UPPER_SNAKE_CASE", "camelCase", "PascalCase"] },
            { target: "functions", allowed: ["camelCase", "PascalCase"] },
            { target: "parameters", allowed: ["camelCase", "PascalCase"] },
            { target: "types", allowed: ["PascalCase"] },
            { target: "enumMembers", allowed: ["UPPER_SNAKE_CASE"] },
            { target: "classMembers", allowed: ["camelCase"] },
            { target: "objectProperties", allowed: ["camelCase"] },
            { target: "typeProperties", allowed: ["camelCase", "PascalCase"] },
          ],
        },
      ],
      generated: [],
      trackedPointers: [{ form: "any-reference" }],
      layers: [],
    });
  });
});

describe("conventionsOf", () => {
  it("gives today's behaviour, and names no key as declared, when the file declares none", () => {
    expect(conventionsOf({ document: { conventions: {}, layers: {} } })).toEqual({
      outcome: "ok",
      value: { conventions: DEFAULT_CONVENTIONS, declared: [] },
    });
  });

  it("reads every declared key into typed values, in place of its default, and names each one declared", () => {
    expect(
      conventionsOf({
        document: {
          conventions: {
            testFiles: { unit: [".test.ts", ".test.tsx"], integration: [".integration.test.ts"] },
            casing: [
              { files: ["**"], fileNames: ["kebab-case", "PascalCase"] },
              { files: ["web/**/*.tsx"], fileNames: ["PascalCase"], functions: ["camelCase", "PascalCase"] },
            ],
            generated: [{ files: ["src/graphql/generated/**"], outsideParty: "@graphql-codegen/cli" }],
            trackedPointers: [{ form: "issue-number" }, { form: "project-key", keys: ["PROJ"] }],
          },
          layers: { domain: ["src/domain"], application: ["src/application"], adapters: ["src/adapters"] },
        },
      }),
    ).toEqual<{ readonly outcome: "ok"; readonly value: ConventionsReading }>({
      outcome: "ok",
      value: {
        conventions: {
          testFiles: { unit: [".test.ts", ".test.tsx"], integration: [".integration.test.ts"] },
          casing: [
            { files: ["**"], casings: [{ target: "fileNames", allowed: ["kebab-case", "PascalCase"] }] },
            {
              files: ["web/**/*.tsx"],
              casings: [
                { target: "fileNames", allowed: ["PascalCase"] },
                { target: "functions", allowed: ["camelCase", "PascalCase"] },
              ],
            },
          ],
          generated: [{ files: ["src/graphql/generated/**"], outsideParty: "@graphql-codegen/cli" }],
          trackedPointers: [{ form: "issue-number" }, { form: "project-key", keys: ["PROJ"] }],
          layers: [
            { layer: "domain", folders: [repoPathSchema.parse("src/domain")] },
            { layer: "application", folders: [repoPathSchema.parse("src/application")] },
            { layer: "adapters", folders: [repoPathSchema.parse("src/adapters")] },
          ],
        },
        declared: ["testFiles", "casing", "generated", "trackedPointers", "layers"],
      },
    });
  });

  it("keeps layers inner to outer and only those declared", () => {
    expect(conventionsOf({ document: { conventions: {}, layers: { adapters: ["src/adapters"], domain: ["src/domain"] } } })).toMatchObject({
      outcome: "ok",
      value: {
        conventions: {
          layers: [
            { layer: "domain", folders: ["src/domain"] },
            { layer: "adapters", folders: ["src/adapters"] },
          ],
        },
        declared: ["layers"],
      },
    });
  });

  type RefusalRow = { readonly name: string; readonly document: unknown; readonly refusal: string };

  it.each<RefusalRow>([
    {
      name: "a casing entry that sets no casing, which would switch the check off",
      document: { conventions: { casing: [{ files: ["**"] }] }, layers: {} },
      refusal: "✖ a casing entry sets at least one of fileNames, variables, constants, functions, parameters, types, enumMembers, classMembers, objectProperties, typeProperties\n  → at conventions.casing[0]",
    },
    {
      name: "a casing entry whose casing list is empty",
      document: { conventions: { casing: [{ files: ["**"], fileNames: [] }] }, layers: {} },
      refusal: "✖ Too small: expected array to have >=1 items\n  → at conventions.casing[0].fileNames",
    },
    {
      name: "a casing outside the closed list",
      document: { conventions: { casing: [{ files: ["**"], fileNames: ["^[a-z]+$"] }] }, layers: {} },
      refusal: "✖ Invalid option: expected one of \"kebab-case\"|\"PascalCase\"|\"camelCase\"|\"UPPER_SNAKE_CASE\"\n  → at conventions.casing[0].fileNames[0]",
    },
    {
      name: "a casing entry that matches no files",
      document: { conventions: { casing: [{ files: [], fileNames: ["kebab-case"] }] }, layers: {} },
      refusal: "✖ Too small: expected array to have >=1 items\n  → at conventions.casing[0].files",
    },
    {
      name: "a test file suffix that is a glob",
      document: { conventions: { testFiles: { unit: ["*.test.ts"], integration: [] } }, layers: {} },
      refusal: "✖ a test file suffix starts with a dot and holds no slash or star\n  → at conventions.testFiles.unit[0]",
    },
    {
      name: "a suffix that is both a unit and an integration test suffix",
      document: { conventions: { testFiles: { unit: [".test.ts"], integration: [".test.ts"] } }, layers: {} },
      refusal: "✖ .test.ts is both a unit and an integration test suffix\n  → at conventions.testFiles",
    },
    {
      name: "no unit test suffix",
      document: { conventions: { testFiles: { unit: [], integration: [] } }, layers: {} },
      refusal: "✖ Too small: expected array to have >=1 items\n  → at conventions.testFiles.unit",
    },
    {
      name: "a pointer form outside the closed list",
      document: { conventions: { trackedPointers: [{ form: "^#\\d+$" }] }, layers: {} },
      refusal:
        "✖ Invalid discriminator value. Expected 'any-reference' | 'issue-number' | 'repository-issue' | 'link' | 'project-key'\n  → at conventions.trackedPointers[0].form",
    },
    {
      name: "a project key that is not upper-case letters and digits",
      document: { conventions: { trackedPointers: [{ form: "project-key", keys: ["proj"] }] }, layers: {} },
      refusal: "✖ a project key is upper-case letters and digits, starting with a letter\n  → at conventions.trackedPointers[0].keys[0]",
    },
    {
      name: "no tracked pointer form",
      document: { conventions: { trackedPointers: [] }, layers: {} },
      refusal: "✖ Too small: expected array to have >=1 items\n  → at conventions.trackedPointers",
    },
    {
      name: "a generated entry with no outside party",
      document: { conventions: { generated: [{ files: ["src/generated/**"], outsideParty: "" }] }, layers: {} },
      refusal: "✖ Too small: expected string to have >=1 characters\n  → at conventions.generated[0].outsideParty",
    },
    {
      name: "a generated entry that names files anywhere, which would switch every check off",
      document: { conventions: { generated: [{ files: ["**/*.ts"], outsideParty: "@graphql-codegen/cli" }] }, layers: {} },
      refusal: "✖ a generated entry names files under a folder, not files anywhere\n  → at conventions.generated[0].files[0]",
    },
    {
      name: "a layer folder that is a glob",
      document: { conventions: {}, layers: { domain: ["src/*/domain"] } },
      refusal: "✖ a layer lists folders git tracks, not globs\n  → at layers.domain[0]",
    },
    {
      name: "a layer folder inside another layer's folder",
      document: { conventions: {}, layers: { domain: ["src"], adapters: ["src/adapters"] } },
      refusal: "✖ src/adapters is inside src; no layer folder sits inside another\n  → at layers",
    },
    {
      name: "a layer the model does not name",
      document: { conventions: {}, layers: { infrastructure: ["src/infrastructure"] } },
      refusal: "✖ Unrecognized key: \"infrastructure\"\n  → at layers",
    },
    {
      name: "a convention the model does not name",
      document: { conventions: { indentation: 2 }, layers: {} },
      refusal: "✖ Unrecognized key: \"indentation\"\n  → at conventions",
    },
  ])("refuses $name", ({ document, refusal }) => {
    expect(conventionsOf({ document })).toEqual({ outcome: "failed", error: refusal });
  });
});
