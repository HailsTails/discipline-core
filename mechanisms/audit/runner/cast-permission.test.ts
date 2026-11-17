import { assert, describe, expect, it } from "vitest";
import type { ClauseSettingValues, RunnerClause } from "../../../core/mechanism-port/runner-module-types.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { defaultParsePort } from "../../../tests/typescript-parse-port.ts";
import { type CastPermission, castJudgeFor, permittedCastsOf } from "./cast-permission.ts";

const SYNTAX_API = defaultParsePort.syntaxApi;
const NEUTRAL_SETTINGS: ClauseSettingValues = { permittedCastTypes: [], permittedCastTypePackages: [] };

const CLAUSE_WITH_NO_SETTINGS: RunnerClause = {
  address: clauseAddressSchema.parse("CD-2#cast-expressions"),
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-2",
  clauseSettings: {},
  settings: { module: "cast-expressions.ts" },
};

const clauseWith = (request: { readonly clauseSettings: ClauseSettingValues }): RunnerClause => ({
  ...CLAUSE_WITH_NO_SETTINGS,
  clauseSettings: request.clauseSettings,
});

const judgedCasts = (request: {
  readonly source: string;
  readonly clauseSettings: ClauseSettingValues;
}): readonly CastPermission[] => {
  const permitted = permittedCastsOf({ clauses: [clauseWith({ clauseSettings: request.clauseSettings })] });
  assert(permitted.outcome === "ok");
  const [settled] = permitted.value;
  assert(settled !== undefined);
  const sourceFile = SYNTAX_API.createSourceFile("src/casts.ts", request.source, SYNTAX_API.ScriptTarget.Latest, true);
  const judge = castJudgeFor({ permitted: settled, sourceFile, syntaxApi: SYNTAX_API });
  return sourceFile.statements.filter(SYNTAX_API.isExpressionStatement).map((statement) => judge({ node: statement.expression }));
};

describe("cast permission with the neutral defaults", () => {
  it.each<{ readonly name: string; readonly source: string; readonly permission: CastPermission }>([
    { name: "an unknown cast", source: "candidate as unknown;\n", permission: "permitted" },
    { name: "a const assertion", source: "['a'] as const;\n", permission: "permitted" },
    { name: "a named type", source: "candidate as Profile;\n", permission: "forbidden" },
    { name: "a name imported from a package", source: "import type { ZodObject } from 'zod';\nschema as ZodObject;\n", permission: "forbidden" },
    { name: "an indexed access type", source: "jsonSchema as Tool['inputSchema'];\n", permission: "forbidden" },
    { name: "an array of a property value", source: "rows.value as ReadonlyArray<Row>;\n", permission: "forbidden" },
    { name: "an angle-bracket assertion", source: "<unknown>candidate;\n", permission: "forbidden" },
    { name: "a literal type", source: "candidate as 'fixed';\n", permission: "forbidden" },
  ])("judges $name as $permission", ({ source, permission }) => {
    expect(judgedCasts({ source, clauseSettings: NEUTRAL_SETTINGS })).toEqual([permission]);
  });
});

describe("cast permission with configured type names", () => {
  const clauseSettings: ClauseSettingValues = {
    permittedCastTypes: ["ReadonlyArray", 'Tool["inputSchema"]', "z.ZodType"],
    permittedCastTypePackages: [],
  };

  it.each<{ readonly name: string; readonly source: string; readonly permission: CastPermission }>([
    { name: "a listed name with type arguments", source: "rows as ReadonlyArray<Row>;\n", permission: "permitted" },
    { name: "a listed indexed access in single quotes", source: "jsonSchema as Tool['inputSchema'];\n", permission: "permitted" },
    { name: "a listed indexed access in double quotes", source: 'jsonSchema as Tool["inputSchema"];\n', permission: "permitted" },
    { name: "a listed qualified name", source: "schema as z.ZodType;\n", permission: "permitted" },
    { name: "an unlisted index of a listed object", source: "jsonSchema as Tool['outputSchema'];\n", permission: "forbidden" },
    { name: "an unlisted name", source: "rows as Array<Row>;\n", permission: "forbidden" },
    { name: "an angle-bracket assertion to a listed name", source: "<ReadonlyArray<Row>>rows;\n", permission: "forbidden" },
  ])("judges $name as $permission", ({ source, permission }) => {
    expect(judgedCasts({ source, clauseSettings })).toEqual([permission]);
  });
});

describe("cast permission with configured type packages", () => {
  const clauseSettings: ClauseSettingValues = { permittedCastTypes: [], permittedCastTypePackages: ["zod"] };

  it.each<{ readonly name: string; readonly source: string; readonly permission: CastPermission }>([
    { name: "a name imported from the package", source: "import { ZodObject } from 'zod';\nschema as ZodObject;\n", permission: "permitted" },
    { name: "an aliased name imported later from a subpath", source: "schema as Schema;\nimport type { ZodObject as Schema } from 'zod/v4';\n", permission: "permitted" },
    { name: "a name from a package sharing the prefix", source: "import { ZodObject } from 'zodiac';\nschema as ZodObject;\n", permission: "forbidden" },
    { name: "a locally declared lookalike name", source: "type ZodCarrier = {};\nschema as ZodCarrier;\n", permission: "forbidden" },
    { name: "a member of a namespace import", source: "import * as z from 'zod';\nschema as z.ZodType;\n", permission: "forbidden" },
    { name: "a default import", source: "import Schema from 'zod';\nschema as Schema;\n", permission: "forbidden" },
  ])("judges $name as $permission", ({ source, permission }) => {
    expect(judgedCasts({ source, clauseSettings })).toEqual([permission]);
  });
});

describe("cast permission settings", () => {
  it.each<{ readonly name: string; readonly clause: RunnerClause }>([
    { name: "no settings", clause: CLAUSE_WITH_NO_SETTINGS },
    { name: "no type packages", clause: clauseWith({ clauseSettings: { permittedCastTypes: [] } }) },
    { name: "a type list that is not an array", clause: clauseWith({ clauseSettings: { permittedCastTypes: "Tool", permittedCastTypePackages: [] } }) },
    { name: "an empty package name", clause: clauseWith({ clauseSettings: { permittedCastTypes: [], permittedCastTypePackages: [""] } }) },
    { name: "an unknown setting", clause: clauseWith({ clauseSettings: { ...NEUTRAL_SETTINGS, permittedCastSites: [] } }) },
  ])("refuses $name, naming the clause", ({ clause }) => {
    expect(permittedCastsOf({ clauses: [clause] })).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: "/install/mechanisms/audit/CD-2",
        detail: expect.stringContaining("the clauseSettings of CD-2#cast-expressions are malformed"),
      },
    });
  });
});
